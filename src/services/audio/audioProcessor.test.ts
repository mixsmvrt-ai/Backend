import { describe, expect, it, vi } from "vitest";
import { AudioProcessor } from "./audioProcessor.js";
import { AudioProcessingError, type AudioMetadataPort, type AudioStoragePort, type AudioUploadRecord, type AudioUploadSession, type AudioValidationPort, type AudioFfmpegPort } from "./types.js";

const baseRecord: AudioUploadRecord = {
  id: "11111111-1111-1111-1111-111111111111",
  userId: "user-1",
  projectId: null,
  originalFile: { bucket: "audio-original", path: "users/user-1/original/test.wav", fileName: "test.wav", mimeType: "audio/wav", sizeBytes: 1024 },
  processedFile: null,
  fileSize: 1024,
  status: "uploaded",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("Audio Processing Engine", () => {
  it("creates a valid upload session", async () => {
    const validation: AudioValidationPort = {
      validateUploadInit: vi.fn(),
      validateUploadedAudio: vi.fn(),
    };
    const session: AudioUploadSession = { audio: baseRecord, uploadUrl: "https://upload", uploadToken: "token" };
    const storage: AudioStoragePort = {
      createUploadSession: vi.fn().mockResolvedValue(session),
      getRecord: vi.fn(),
      downloadOriginalToTemp: vi.fn(),
      uploadProcessedFile: vi.fn(),
      markStatus: vi.fn(),
      updateMetadata: vi.fn(),
      signedUrls: vi.fn(),
      delete: vi.fn(),
    };
    const processor = new AudioProcessor(storage, validation, {} as AudioMetadataPort, {} as AudioFfmpegPort);
    const result = await processor.createUploadSession("user-1", { fileName: "voice.wav", mimeType: "audio/wav", sizeBytes: 1024 });
    expect(result.uploadUrl).toBe("https://upload");
    expect(validation.validateUploadInit).toHaveBeenCalled();
  });

  it("rejects oversized files during validation", async () => {
    const validation: AudioValidationPort = {
      validateUploadInit: vi.fn(() => { throw new AudioProcessingError("too large", "AUDIO_TOO_LARGE", 413); }),
      validateUploadedAudio: vi.fn(),
    };
    const processor = new AudioProcessor({} as AudioStoragePort, validation, {} as AudioMetadataPort, {} as AudioFfmpegPort);
    await expect(processor.createUploadSession("user-1", { fileName: "voice.wav", mimeType: "audio/wav", sizeBytes: 25_000_000 })).rejects.toThrow("too large");
  });

  it("rejects long recordings before processing completes", async () => {
    const storage = createProcessingStorage();
    const validation: AudioValidationPort = {
      validateUploadInit: vi.fn(),
      validateUploadedAudio: vi.fn(() => { throw new AudioProcessingError("too long", "AUDIO_TOO_LONG", 422); }),
    };
    const ffmpeg = createFfmpegMock();
    const processor = new AudioProcessor(storage, validation, createMetadataMock(), ffmpeg);
    await expect(processor.process("user-1", { audioId: baseRecord.id })).rejects.toThrow("too long");
  });

  it("rejects corrupt audio", async () => {
    const storage = createProcessingStorage();
    const validation: AudioValidationPort = {
      validateUploadInit: vi.fn(),
      validateUploadedAudio: vi.fn(() => { throw new AudioProcessingError("corrupt", "AUDIO_CORRUPT", 422); }),
    };
    const ffmpeg = createFfmpegMock();
    const processor = new AudioProcessor(storage, validation, createMetadataMock(), ffmpeg);
    await expect(processor.process("user-1", { audioId: baseRecord.id })).rejects.toThrow("corrupt");
  });

  it("runs trimming, mono conversion, resampling, and metadata extraction", async () => {
    const storage = createProcessingStorage();
    const validation: AudioValidationPort = {
      validateUploadInit: vi.fn(),
      validateUploadedAudio: vi.fn(),
    };
    const ffmpeg = createFfmpegMock();
    const metadata = createMetadataMock();
    const processor = new AudioProcessor(storage, validation, metadata, ffmpeg);
    const result = await processor.process("user-1", { audioId: baseRecord.id, applyHighPassFilter: true });
    expect(result.audio.status).toBe("processed");
    expect(ffmpeg.processToDetectionWav).toHaveBeenCalled();
    const filters = vi.mocked(ffmpeg.processToDetectionWav).mock.calls[0]?.[2] ?? [];
    expect(filters.join(",")).toContain("silenceremove");
    expect(filters.join(",")).toContain("aformat=channel_layouts=mono");
    expect(filters.join(",")).toContain("aresample=16000");
    expect(metadata.extract).toHaveBeenCalled();
  });

  it("returns metadata view", async () => {
    const storage = createProcessingStorage();
    const processor = new AudioProcessor(storage, { validateUploadInit: vi.fn(), validateUploadedAudio: vi.fn() }, createMetadataMock(), createFfmpegMock());
    const result = await processor.metadataFor("user-1", baseRecord.id);
    expect(result.status).toBe("processed");
    expect(result.sampleRate).toBe(16000);
  });
});

function createProcessingStorage(): AudioStoragePort {
  const processedRecord: AudioUploadRecord = {
    ...baseRecord,
    status: "processed",
    processedFile: { bucket: "audio-processed", path: "users/user-1/processed/test.wav", fileName: "test.wav", mimeType: "audio/wav", sizeBytes: 2048 },
    duration: 12.5,
    sampleRate: 16000,
    channels: 1,
    codec: "pcm_s16le",
    bitrate: 256000,
    bitDepth: 16,
    peakLevelDb: -2,
    rmsLevelDb: -15,
    estimatedSilenceDurationSeconds: 0.4,
    waveformPeaks: [0.1, 0.2],
  };
  return {
    createUploadSession: vi.fn(),
    getRecord: vi.fn().mockResolvedValue(processedRecord),
    downloadOriginalToTemp: vi.fn().mockResolvedValue("C:/temp/input.wav"),
    uploadProcessedFile: vi.fn().mockResolvedValue(processedRecord.processedFile),
    markStatus: vi.fn().mockImplementation(async (_record, status) => ({ ...baseRecord, status })),
    updateMetadata: vi.fn().mockResolvedValue(processedRecord),
    signedUrls: vi.fn().mockResolvedValue({ originalUrl: "https://original", processedUrl: "https://processed" }),
    delete: vi.fn(),
  };
}

function createFfmpegMock(): AudioFfmpegPort {
  return {
    probe: vi.fn().mockResolvedValue({ durationSeconds: 12, sampleRate: 44100, channels: 2, bitDepth: 16, codec: "pcm_s16le", bitrate: 320000 }),
    analyzeLevels: vi.fn().mockResolvedValue({ peakLevelDb: -2, rmsLevelDb: -15 }),
    detectSilence: vi.fn().mockResolvedValue(0.4),
    processToDetectionWav: vi.fn().mockResolvedValue(undefined),
  };
}

function createMetadataMock(): AudioMetadataPort {
  return {
    extract: vi.fn().mockResolvedValue({ durationSeconds: 12, sampleRate: 16000, channels: 1, bitDepth: 16, codec: "pcm_s16le", bitrate: 256000, peakLevelDb: -2, rmsLevelDb: -15, estimatedSilenceDurationSeconds: 0.4, fileSizeBytes: 2048, waveformPeaks: [0.1, 0.2] }),
  };
}