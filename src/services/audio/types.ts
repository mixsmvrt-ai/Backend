export type AudioUploadStatus = "pending_upload" | "uploaded" | "processing" | "processed" | "failed" | "deleted";

export interface AudioFileDescriptor {
  bucket: string;
  path: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface AudioUploadInitInput {
  projectId?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface AudioUploadMetadata {
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  bitDepth?: number;
  codec: string;
  bitrate?: number;
  peakLevelDb?: number;
  rmsLevelDb?: number;
  estimatedSilenceDurationSeconds?: number;
  fileSizeBytes: number;
  waveformPeaks?: number[];
}

export interface AudioUploadRecord {
  id: string;
  userId: string;
  projectId?: string | null;
  originalFile: AudioFileDescriptor;
  processedFile?: AudioFileDescriptor | null;
  duration?: number | null;
  sampleRate?: number | null;
  channels?: number | null;
  bitDepth?: number | null;
  codec?: string | null;
  bitrate?: number | null;
  peakLevelDb?: number | null;
  rmsLevelDb?: number | null;
  estimatedSilenceDurationSeconds?: number | null;
  waveformPeaks?: number[] | null;
  fileSize: number;
  status: AudioUploadStatus;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AudioSignedUrls {
  originalUrl?: string;
  processedUrl?: string;
}

export interface AudioUploadSession {
  audio: AudioUploadRecord;
  uploadUrl: string;
  uploadToken: string;
}

export interface AudioProcessOptions {
  audioId: string;
  applyHighPassFilter?: boolean;
}

export interface AudioProcessResult {
  audio: AudioUploadRecord;
  urls: AudioSignedUrls;
}

export interface AudioProbeResult {
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  bitDepth?: number;
  codec: string;
  bitrate?: number;
}

export interface AudioLevels {
  peakLevelDb?: number;
  rmsLevelDb?: number;
}

export interface AudioValidationConfig {
  maxUploadSizeBytes: number;
  maxDurationSeconds: number;
  supportedMimeTypes: ReadonlySet<string>;
  supportedExtensions: ReadonlySet<string>;
}

export interface AudioStoragePort {
  createUploadSession(userId: string, input: AudioUploadInitInput): Promise<AudioUploadSession>;
  getRecord(userId: string, audioId: string): Promise<AudioUploadRecord>;
  downloadOriginalToTemp(record: AudioUploadRecord): Promise<string>;
  uploadProcessedFile(record: AudioUploadRecord, localFilePath: string): Promise<AudioFileDescriptor>;
  markStatus(record: AudioUploadRecord, status: AudioUploadStatus, errorMessage?: string | null): Promise<AudioUploadRecord>;
  updateMetadata(record: AudioUploadRecord, metadata: AudioUploadMetadata, processedFile?: AudioFileDescriptor | null, status?: AudioUploadStatus): Promise<AudioUploadRecord>;
  signedUrls(record: AudioUploadRecord): Promise<AudioSignedUrls>;
  delete(userId: string, audioId: string): Promise<void>;
}

export interface AudioValidationPort {
  validateUploadInit(input: AudioUploadInitInput): void;
  validateUploadedAudio(record: AudioUploadRecord, metadata: AudioProbeResult): void;
}

export interface AudioMetadataPort {
  extract(filePath: string): Promise<AudioUploadMetadata>;
}

export interface AudioFfmpegPort {
  probe(filePath: string): Promise<AudioProbeResult>;
  analyzeLevels(filePath: string): Promise<AudioLevels>;
  detectSilence(filePath: string): Promise<number>;
  processToDetectionWav(inputPath: string, outputPath: string, filters: string[], sampleRate: number, timeoutMs: number): Promise<void>;
}

export class AudioProcessingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "AudioProcessingError";
  }
}