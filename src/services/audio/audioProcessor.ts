import { dirname, join } from "node:path";
import { metadataService } from "./metadata.js";
import { noiseReductionService } from "./noiseReduction.js";
import { normalizerService } from "./normalizer.js";
import { resamplerService } from "./resampler.js";
import { audioStorageService } from "./storage.js";
import { trimSilenceService } from "./trimSilence.js";
import { cleanupTempWorkspace } from "./utils.js";
import { audioValidationService } from "./validation.js";
import type { AudioMetadataPort, AudioProcessOptions, AudioProcessResult, AudioStoragePort, AudioUploadInitInput, AudioUploadSession, AudioValidationPort, AudioFfmpegPort } from "./types.js";
import { ffmpegService } from "./ffmpeg.service.js";
import { env } from "../../config/env.js";

export class AudioProcessor {
  constructor(
    private readonly storage: AudioStoragePort = audioStorageService,
    private readonly validation: AudioValidationPort = audioValidationService,
    private readonly metadata: AudioMetadataPort = metadataService,
    private readonly ffmpeg: AudioFfmpegPort = ffmpegService,
  ) {}

  async createUploadSession(userId: string, input: AudioUploadInitInput): Promise<AudioUploadSession> {
    console.info("[audio] upload started", { userId, fileName: input.fileName, sizeBytes: input.sizeBytes, mimeType: input.mimeType });
    this.validation.validateUploadInit(input);
    const session = await this.storage.createUploadSession(userId, input);
    console.info("[audio] upload session created", { userId, audioId: session.audio.id, bucket: session.audio.originalFile.bucket });
    return session;
  }

  async process(userId: string, options: AudioProcessOptions): Promise<AudioProcessResult> {
    const start = Date.now();
    let record = await this.storage.getRecord(userId, options.audioId);
    console.info("[audio] processing started", { userId, audioId: record.id, originalPath: record.originalFile.path });
    record = await this.storage.markStatus(record, "processing");
    const inputPath = await this.storage.downloadOriginalToTemp(record);
    const workspace = dirname(inputPath);
    const outputPath = join(workspace, `${record.id}-processed.wav`);

    try {
      const probe = await this.ffmpeg.probe(inputPath);
      this.validation.validateUploadedAudio(record, probe);
      console.info("[audio] validation result", { audioId: record.id, durationSeconds: probe.durationSeconds, sampleRate: probe.sampleRate, channels: probe.channels, codec: probe.codec });

      const filters = [
        ...normalizerService.filters(),
        ...trimSilenceService.filters(),
        ...resamplerService.filters(env.AUDIO_TARGET_SAMPLE_RATE),
        ...noiseReductionService.filters({ highPassEnabled: options.applyHighPassFilter ?? env.AUDIO_ENABLE_HIGH_PASS_FILTER }),
      ];
      await this.ffmpeg.processToDetectionWav(inputPath, outputPath, filters, env.AUDIO_TARGET_SAMPLE_RATE, env.AUDIO_PROCESS_TIMEOUT_MS);
      const processedFile = await this.storage.uploadProcessedFile(record, outputPath);
      const processedMetadata = await this.metadata.extract(outputPath);
      record = await this.storage.updateMetadata(record, processedMetadata, processedFile, "processed");
      const urls = await this.storage.signedUrls(record);
      console.info("[audio] pipeline completed", { audioId: record.id, processedPath: processedFile.path, processingDurationMs: Date.now() - start });
      return { audio: record, urls };
    } catch (error) {
      await this.storage.markStatus(record, "failed", error instanceof Error ? error.message : "Audio processing failed");
      console.error("[audio] processing failed", { audioId: record.id, durationMs: Date.now() - start, error: error instanceof Error ? error.message : error });
      throw error;
    } finally {
      await cleanupTempWorkspace(workspace);
    }
  }

  async get(userId: string, audioId: string): Promise<AudioProcessResult> {
    const record = await this.storage.getRecord(userId, audioId);
    return { audio: record, urls: await this.storage.signedUrls(record) };
  }

  async metadataFor(userId: string, audioId: string) {
    const record = await this.storage.getRecord(userId, audioId);
    return {
      id: record.id,
      duration: record.duration,
      sampleRate: record.sampleRate,
      channels: record.channels,
      bitDepth: record.bitDepth,
      codec: record.codec,
      bitrate: record.bitrate,
      peakLevelDb: record.peakLevelDb,
      rmsLevelDb: record.rmsLevelDb,
      estimatedSilenceDurationSeconds: record.estimatedSilenceDurationSeconds,
      fileSize: record.fileSize,
      waveformPeaks: record.waveformPeaks,
      status: record.status,
    };
  }

  async remove(userId: string, audioId: string): Promise<void> {
    console.info("[audio] delete requested", { userId, audioId });
    await this.storage.delete(userId, audioId);
  }
}

export const audioProcessor = new AudioProcessor();