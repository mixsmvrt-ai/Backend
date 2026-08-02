import { stat } from "node:fs/promises";
import type { AudioFfmpegPort, AudioMetadataPort, AudioUploadMetadata } from "./types.js";
import { ffmpegService } from "./ffmpeg.service.js";
import { waveformService, type WaveformService } from "./waveform.js";

export class MetadataService implements AudioMetadataPort {
  constructor(
    private readonly ffmpeg: AudioFfmpegPort = ffmpegService,
    private readonly waveform: WaveformService = waveformService,
  ) {}

  async extract(filePath: string): Promise<AudioUploadMetadata> {
    const [probe, levels, silenceDuration, fileStats, peaks] = await Promise.all([
      this.ffmpeg.probe(filePath),
      this.ffmpeg.analyzeLevels(filePath),
      this.ffmpeg.detectSilence(filePath),
      stat(filePath),
      this.waveform.peaks(filePath).catch(() => []),
    ]);

    return {
      durationSeconds: probe.durationSeconds,
      sampleRate: probe.sampleRate,
      channels: probe.channels,
      bitDepth: probe.bitDepth,
      codec: probe.codec,
      bitrate: probe.bitrate,
      peakLevelDb: levels.peakLevelDb,
      rmsLevelDb: levels.rmsLevelDb,
      estimatedSilenceDurationSeconds: silenceDuration,
      fileSizeBytes: fileStats.size,
      waveformPeaks: peaks,
    };
  }
}

export const metadataService = new MetadataService();

export type { WaveformService } from "./waveform.js";