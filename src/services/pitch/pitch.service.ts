import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { env } from "../../config/env.js";
import { requireSupabase } from "../../config/supabase.js";
import { cleanupPitchTempWorkspace, createPitchTempWorkspace, withTimeout, writeTempFile } from "./utils.js";
import type { PitchAnalysisRecord, PitchAnalysisRequest, PitchAnalysisResult, PitchAudioSource, PitchProviderName } from "./types.js";
import { PitchAnalysisError } from "./types.js";
import type { PitchAnalysisRepository, PitchDetectionService } from "./pitch.interface.js";
import { pitchProviderFactory, type PitchProviderFactory } from "./pitch.factory.js";

type PitchAnalysisRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  audio_upload_id: string;
  provider: PitchProviderName;
  estimated_bpm: number | null;
  estimated_key: string | null;
  estimated_scale: string | null;
  overall_confidence: number;
  analysis_json: PitchAnalysisResult;
  created_at: string;
};

type AudioUploadRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  status: string;
  duration: number | null;
  sample_rate: number | null;
  channels: number | null;
  processed_file: PitchAudioSource["processedFile"];
};

function mapAnalysis(row: PitchAnalysisRow): PitchAnalysisRecord {
  return {
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    audioUploadId: row.audio_upload_id,
    provider: row.provider,
    estimatedBpm: row.estimated_bpm,
    estimatedKey: row.estimated_key,
    estimatedScale: row.estimated_scale,
    overallConfidence: row.overall_confidence,
    analysis: row.analysis_json,
    createdAt: row.created_at,
  };
}

function mapAudio(row: AudioUploadRow): PitchAudioSource {
  return {
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    status: row.status,
    duration: row.duration,
    sampleRate: row.sample_rate,
    channels: row.channels,
    processedFile: row.processed_file,
  };
}

export class SupabasePitchRepository implements PitchAnalysisRepository {
  async getAudioSource(userId: string, audioId: string): Promise<PitchAudioSource> {
    const { data, error } = await requireSupabase().from("audio_uploads").select("id,user_id,project_id,status,duration,sample_rate,channels,processed_file").eq("id", audioId).eq("user_id", userId).single();
    if (error || !data) {
      throw new PitchAnalysisError("Processed audio source not found.", "PITCH_SOURCE_NOT_FOUND", 404);
    }

    const source = mapAudio(data as AudioUploadRow);
    if (source.status !== "processed" || !source.processedFile) {
      throw new PitchAnalysisError("Audio must be processed before pitch analysis starts.", "PITCH_SOURCE_NOT_READY", 422);
    }
    return source;
  }

  async downloadProcessedAudio(source: PitchAudioSource): Promise<string> {
    const { data, error } = await requireSupabase().storage.from(source.processedFile!.bucket).download(source.processedFile!.path);
    if (error || !data) {
      throw new PitchAnalysisError(`Processed audio file could not be downloaded: ${error?.message ?? "not found"}`, "PITCH_SOURCE_MISSING", 422);
    }

    const workspace = await createPitchTempWorkspace(env.AUDIO_TEMP_DIR);
    const filePath = join(workspace, source.processedFile!.fileName);
    const buffer = Buffer.from(await data.arrayBuffer());
    await writeTempFile(filePath, buffer);
    return filePath;
  }

  async createAnalysis(userId: string, source: PitchAudioSource, provider: PitchProviderName, analysis: PitchAnalysisResult): Promise<PitchAnalysisRecord> {
    const { data, error } = await requireSupabase().from("pitch_analysis").insert({
      user_id: userId,
      project_id: source.projectId,
      audio_upload_id: source.id,
      provider,
      estimated_bpm: analysis.tempo.bpm,
      estimated_key: analysis.estimatedKey.key,
      estimated_scale: analysis.estimatedScale.scale,
      overall_confidence: analysis.confidence.overall,
      analysis_json: analysis,
    }).select("*").single();

    if (error || !data) {
      throw new PitchAnalysisError(`Pitch analysis could not be stored: ${error?.message ?? "unknown error"}`, "PITCH_DB_CREATE_FAILED", 502);
    }
    return mapAnalysis(data as PitchAnalysisRow);
  }

  async getAnalysis(userId: string, analysisId: string): Promise<PitchAnalysisRecord> {
    const { data, error } = await requireSupabase().from("pitch_analysis").select("*").eq("id", analysisId).eq("user_id", userId).single();
    if (error || !data) {
      throw new PitchAnalysisError("Pitch analysis not found.", "PITCH_NOT_FOUND", 404);
    }
    return mapAnalysis(data as PitchAnalysisRow);
  }

  async deleteAnalysis(userId: string, analysisId: string): Promise<void> {
    const { error } = await requireSupabase().from("pitch_analysis").delete().eq("id", analysisId).eq("user_id", userId);
    if (error) {
      throw new PitchAnalysisError(`Pitch analysis could not be deleted: ${error.message}`, "PITCH_DELETE_FAILED", 502);
    }
  }
}

export class PitchService implements PitchDetectionService {
  constructor(
    private readonly repository: PitchAnalysisRepository = new SupabasePitchRepository(),
    private readonly factory: PitchProviderFactory = pitchProviderFactory,
  ) {}

  async analyze(userId: string, request: PitchAnalysisRequest): Promise<PitchAnalysisRecord> {
    const source = await this.repository.getAudioSource(userId, request.audioId);
    const provider = this.factory.resolve(request.provider);
    const start = Date.now();
    console.info("[pitch] analysis started", { userId, audioId: source.id, provider: provider.name, duration: source.duration });
    const filePath = await this.repository.downloadProcessedAudio(source);
    const workspace = filePath.slice(0, Math.max(0, filePath.lastIndexOf("\\")) || Math.max(0, filePath.lastIndexOf("/")));

    try {
      const analysis = await withTimeout(provider.analyze(filePath, source, env.PITCH_CONFIDENCE_THRESHOLD), env.PITCH_ANALYSIS_TIMEOUT_MS, "Pitch analysis timed out.");
      const record = await this.repository.createAnalysis(userId, source, provider.name, analysis);
      console.info("[pitch] analysis completed", { analysisId: record.id, provider: provider.name, durationMs: Date.now() - start, confidence: analysis.confidence.overall, bpm: analysis.tempo.bpm });
      return record;
    } catch (error) {
      console.error("[pitch] analysis failed", { audioId: source.id, provider: provider.name, durationMs: Date.now() - start, error: error instanceof Error ? error.message : error });
      throw error;
    } finally {
      if (workspace) {
        await cleanupPitchTempWorkspace(workspace);
      }
    }
  }

  get(userId: string, analysisId: string) {
    return this.repository.getAnalysis(userId, analysisId);
  }

  remove(userId: string, analysisId: string) {
    console.info("[pitch] delete requested", { userId, analysisId });
    return this.repository.deleteAnalysis(userId, analysisId);
  }
}

export const pitchService = new PitchService();