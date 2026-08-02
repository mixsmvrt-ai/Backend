import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireSupabase } from "../../config/supabase.js";
import { env } from "../../config/env.js";
import { AudioProcessingError, type AudioFileDescriptor, type AudioSignedUrls, type AudioStoragePort, type AudioUploadInitInput, type AudioUploadMetadata, type AudioUploadRecord, type AudioUploadSession, type AudioUploadStatus } from "./types.js";
import { buildStoragePath, createTempWorkspace, safeFileName } from "./utils.js";

type AudioUploadRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  original_file: AudioFileDescriptor;
  processed_file: AudioFileDescriptor | null;
  duration: number | null;
  sample_rate: number | null;
  channels: number | null;
  bit_depth: number | null;
  codec: string | null;
  bitrate: number | null;
  peak_level_db: number | null;
  rms_level_db: number | null;
  silence_duration_seconds: number | null;
  waveform_peaks: number[] | null;
  file_size: number;
  status: AudioUploadStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

function mapRecord(row: AudioUploadRow): AudioUploadRecord {
  return {
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    originalFile: row.original_file,
    processedFile: row.processed_file,
    duration: row.duration,
    sampleRate: row.sample_rate,
    channels: row.channels,
    bitDepth: row.bit_depth,
    codec: row.codec,
    bitrate: row.bitrate,
    peakLevelDb: row.peak_level_db,
    rmsLevelDb: row.rms_level_db,
    estimatedSilenceDurationSeconds: row.silence_duration_seconds,
    waveformPeaks: row.waveform_peaks,
    fileSize: row.file_size,
    status: row.status,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class AudioStorageService implements AudioStoragePort {
  async createUploadSession(userId: string, input: AudioUploadInitInput): Promise<AudioUploadSession> {
    const db = requireSupabase();
    const safeName = safeFileName(input.fileName);
    const path = buildStoragePath(userId, "original", safeName, input.projectId);
    const originalFile: AudioFileDescriptor = {
      bucket: env.AUDIO_ORIGINAL_BUCKET,
      path,
      fileName: safeName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    };

    const { data: upload, error: uploadError } = await db.storage.from(env.AUDIO_ORIGINAL_BUCKET).createSignedUploadUrl(path);
    if (uploadError) throw new AudioProcessingError(`Failed to prepare audio upload: ${uploadError.message}`, "AUDIO_STORAGE_UPLOAD_INIT_FAILED", 502);

    const { data, error } = await db.from("audio_uploads").insert({
      user_id: userId,
      project_id: input.projectId ?? null,
      original_file: originalFile,
      processed_file: null,
      file_size: input.sizeBytes,
      status: "pending_upload",
    }).select("*").single();
    if (error) throw new AudioProcessingError(`Failed to create audio upload record: ${error.message}`, "AUDIO_DB_CREATE_FAILED", 502);

    return {
      audio: mapRecord(data as AudioUploadRow),
      uploadUrl: upload.signedUrl,
      uploadToken: upload.token,
    };
  }

  async getRecord(userId: string, audioId: string): Promise<AudioUploadRecord> {
    const { data, error } = await requireSupabase().from("audio_uploads").select("*").eq("id", audioId).eq("user_id", userId).single();
    if (error || !data) throw new AudioProcessingError("Audio upload not found.", "AUDIO_NOT_FOUND", 404);
    return mapRecord(data as AudioUploadRow);
  }

  async downloadOriginalToTemp(record: AudioUploadRecord): Promise<string> {
    const db = requireSupabase();
    const { data, error } = await db.storage.from(record.originalFile.bucket).download(record.originalFile.path);
    if (error || !data) throw new AudioProcessingError(`Original audio file is missing from storage: ${error?.message ?? "not found"}`, "AUDIO_MISSING_SOURCE", 422);

    const workspace = await createTempWorkspace(env.AUDIO_TEMP_DIR);
    const localPath = join(workspace, record.originalFile.fileName);
    const arrayBuffer = await data.arrayBuffer();
    await writeFile(localPath, Buffer.from(arrayBuffer));
    return localPath;
  }

  async uploadProcessedFile(record: AudioUploadRecord, localFilePath: string): Promise<AudioFileDescriptor> {
    const db = requireSupabase();
    const buffer = await import("node:fs/promises").then((fs) => fs.readFile(localFilePath));
    const fileName = `${record.id}-processed.wav`;
    const path = buildStoragePath(record.userId, "processed", fileName, record.projectId ?? undefined);
    const { error } = await db.storage.from(env.AUDIO_PROCESSED_BUCKET).upload(path, buffer, { contentType: "audio/wav", upsert: true });
    if (error) throw new AudioProcessingError(`Failed to store processed audio: ${error.message}`, "AUDIO_STORAGE_UPLOAD_FAILED", 502);
    return { bucket: env.AUDIO_PROCESSED_BUCKET, path, fileName, mimeType: "audio/wav", sizeBytes: buffer.byteLength };
  }

  async markStatus(record: AudioUploadRecord, status: AudioUploadStatus, errorMessage?: string | null): Promise<AudioUploadRecord> {
    const { data, error } = await requireSupabase().from("audio_uploads").update({ status, error_message: errorMessage ?? null, updated_at: new Date().toISOString() }).eq("id", record.id).eq("user_id", record.userId).select("*").single();
    if (error || !data) throw new AudioProcessingError(`Failed to update audio upload status: ${error?.message ?? "unknown error"}`, "AUDIO_DB_UPDATE_FAILED", 502);
    return mapRecord(data as AudioUploadRow);
  }

  async updateMetadata(record: AudioUploadRecord, metadata: AudioUploadMetadata, processedFile?: AudioFileDescriptor | null, status: AudioUploadStatus = "processed"): Promise<AudioUploadRecord> {
    const { data, error } = await requireSupabase().from("audio_uploads").update({
      processed_file: processedFile ?? record.processedFile ?? null,
      duration: metadata.durationSeconds,
      sample_rate: metadata.sampleRate,
      channels: metadata.channels,
      bit_depth: metadata.bitDepth ?? null,
      codec: metadata.codec,
      bitrate: metadata.bitrate ?? null,
      peak_level_db: metadata.peakLevelDb ?? null,
      rms_level_db: metadata.rmsLevelDb ?? null,
      silence_duration_seconds: metadata.estimatedSilenceDurationSeconds ?? null,
      waveform_peaks: metadata.waveformPeaks ?? null,
      file_size: metadata.fileSizeBytes,
      status,
      error_message: null,
      updated_at: new Date().toISOString(),
    }).eq("id", record.id).eq("user_id", record.userId).select("*").single();
    if (error || !data) throw new AudioProcessingError(`Failed to persist audio metadata: ${error?.message ?? "unknown error"}`, "AUDIO_DB_UPDATE_FAILED", 502);
    return mapRecord(data as AudioUploadRow);
  }

  async signedUrls(record: AudioUploadRecord): Promise<AudioSignedUrls> {
    const db = requireSupabase();
    const signed: AudioSignedUrls = {};
    const sign = async (bucket: string, path: string) => {
      const { data, error } = await db.storage.from(bucket).createSignedUrl(path, 900);
      if (error) throw new AudioProcessingError(`Failed to sign audio URL: ${error.message}`, "AUDIO_SIGNING_FAILED", 502);
      return data.signedUrl;
    };
    signed.originalUrl = await sign(record.originalFile.bucket, record.originalFile.path);
    if (record.processedFile) signed.processedUrl = await sign(record.processedFile.bucket, record.processedFile.path);
    return signed;
  }

  async delete(userId: string, audioId: string): Promise<void> {
    const record = await this.getRecord(userId, audioId);
    const db = requireSupabase();
    await Promise.all([
      db.storage.from(record.originalFile.bucket).remove([record.originalFile.path]),
      record.processedFile ? db.storage.from(record.processedFile.bucket).remove([record.processedFile.path]) : Promise.resolve({ error: null }),
    ]);
    const { error } = await db.from("audio_uploads").delete().eq("id", audioId).eq("user_id", userId);
    if (error) throw new AudioProcessingError(`Failed to delete audio upload: ${error.message}`, "AUDIO_DELETE_FAILED", 502);
  }
}

export const audioStorageService = new AudioStorageService();