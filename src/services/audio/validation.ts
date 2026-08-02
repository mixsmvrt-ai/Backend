import type { AudioProbeResult, AudioUploadInitInput, AudioUploadRecord, AudioValidationConfig, AudioValidationPort } from "./types.js";
import { AudioProcessingError } from "./types.js";
import { DEFAULT_VALIDATION_CONFIG } from "./constants.js";
import { extensionOf } from "./utils.js";

export class AudioValidationService implements AudioValidationPort {
  constructor(private readonly config: AudioValidationConfig = DEFAULT_VALIDATION_CONFIG) {}

  validateUploadInit(input: AudioUploadInitInput) {
    if (input.sizeBytes > this.config.maxUploadSizeBytes) {
      throw new AudioProcessingError(`Audio upload exceeds the ${Math.floor(this.config.maxUploadSizeBytes / (1024 * 1024))} MB limit.`, "AUDIO_TOO_LARGE", 413);
    }

    const extension = extensionOf(input.fileName);
    if (!this.config.supportedExtensions.has(extension)) {
      throw new AudioProcessingError("Unsupported audio file extension.", "AUDIO_UNSUPPORTED_EXTENSION", 422);
    }

    if (!this.config.supportedMimeTypes.has(input.mimeType)) {
      throw new AudioProcessingError("Unsupported audio MIME type.", "AUDIO_UNSUPPORTED_MIME", 422);
    }
  }

  validateUploadedAudio(record: AudioUploadRecord, metadata: AudioProbeResult) {
    if (metadata.durationSeconds <= 0 || metadata.sampleRate <= 0 || metadata.channels <= 0) {
      throw new AudioProcessingError("Uploaded audio is corrupt or unreadable.", "AUDIO_CORRUPT", 422);
    }

    if (metadata.durationSeconds > this.config.maxDurationSeconds) {
      throw new AudioProcessingError(`Uploaded audio exceeds the ${this.config.maxDurationSeconds} second duration limit.`, "AUDIO_TOO_LONG", 422);
    }

    const extension = extensionOf(record.originalFile.fileName);
    if (!this.config.supportedExtensions.has(extension)) {
      throw new AudioProcessingError("Uploaded audio has an unsupported format.", "AUDIO_UNSUPPORTED_EXTENSION", 422);
    }

    if (!this.config.supportedMimeTypes.has(record.originalFile.mimeType)) {
      throw new AudioProcessingError("Uploaded audio has an unsupported MIME type.", "AUDIO_UNSUPPORTED_MIME", 422);
    }
  }
}

export const audioValidationService = new AudioValidationService();