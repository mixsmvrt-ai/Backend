import type { AudioUploadStatus, AudioValidationConfig } from "./types.js";

export const SUPPORTED_AUDIO_EXTENSIONS = new Set([".wav", ".mp3", ".m4a", ".aac", ".ogg", ".flac"]);
export const SUPPORTED_AUDIO_MIME_TYPES = new Set([
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/ogg",
  "audio/flac",
  "audio/x-flac",
]);

export const AUDIO_UPLOAD_STATUSES: ReadonlyArray<AudioUploadStatus> = ["pending_upload", "uploaded", "processing", "processed", "failed", "deleted"];

export const DEFAULT_VALIDATION_CONFIG: AudioValidationConfig = {
  maxUploadSizeBytes: 20 * 1024 * 1024,
  maxDurationSeconds: 60,
  supportedMimeTypes: SUPPORTED_AUDIO_MIME_TYPES,
  supportedExtensions: SUPPORTED_AUDIO_EXTENSIONS,
};

export const DEFAULT_AUDIO_TARGET_SAMPLE_RATE = 16_000;
export const DEFAULT_HIGH_PASS_FREQUENCY_HZ = 80;
export const DEFAULT_PROCESS_TIMEOUT_MS = 60_000;
export const DEFAULT_AUDIO_TEMP_DIR_NAME = "midiflow-audio";
export const DEFAULT_WAVEFORM_BUCKETS = 128;