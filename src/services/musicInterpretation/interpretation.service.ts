import { requireSupabase } from "../../config/supabase.js";
import type { PitchAnalysisResult } from "../pitch/types.js";
import { MusicInterpretationError, type InterpretationContext, type InterpretationInput, type InterpretationRepository, type InterpretationSourceRecord, type MusicInterpretationRecord, type MusicInterpretationRequest, type MusicInterpretationResult } from "./types.js";
import { analyzeEmotion } from "./emotionAnalyzer.js";
import { analyzeEnergy } from "./energyAnalyzer.js";
import { analyzeGenres } from "./genreAnalyzer.js";
import { analyzeHarmony } from "./harmonyAnalyzer.js";
import { analyzeIntervals } from "./intervalAnalyzer.js";
import { analyzeKey } from "./keyAnalyzer.js";
import { analyzeMelody } from "./melodyAnalyzer.js";
import { analyzeMotifs } from "./motifAnalyzer.js";
import { analyzePhrases } from "./phraseAnalyzer.js";
import { buildRecommendations } from "./recommendations.js";
import { analyzeRhythm } from "./rhythmAnalyzer.js";
import { analyzeScale } from "./scaleAnalyzer.js";
import { complexityScore, melodicStatistics, performanceStatistics } from "./statistics.js";
import { analyzeVariations } from "./variationAnalyzer.js";
import { analyzeGroove } from "./grooveAnalyzer.js";

type InterpretationRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  pitch_analysis_id: string | null;
  confidence: number;
  interpretation_json: MusicInterpretationResult;
  recommendations_json: MusicInterpretationResult["recommendations"];
  created_at: string;
};

type PitchRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  audio_upload_id: string;
  provider: string;
  estimated_bpm: number | null;
  estimated_key: string | null;
  estimated_scale: string | null;
  overall_confidence: number;
  analysis_json: PitchAnalysisResult;
};

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function mapRecord(row: InterpretationRow): MusicInterpretationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    pitchAnalysisId: row.pitch_analysis_id,
    confidence: row.confidence,
    interpretation: row.interpretation_json,
    recommendations: row.recommendations_json,
    createdAt: row.created_at,
  };
}

function mapPitch(row: PitchRow): InterpretationSourceRecord {
  return {
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    analysis: row.analysis_json,
    estimatedBpm: row.estimated_bpm,
    estimatedKey: row.estimated_key,
    estimatedScale: row.estimated_scale,
    overallConfidence: row.overall_confidence,
    provider: row.provider,
    audioUploadId: row.audio_upload_id,
  };
}

function ensureUsableAnalysis(analysis: PitchAnalysisResult) {
  if (!analysis.detectedNotes.length) {
    throw new MusicInterpretationError("Pitch analysis does not contain notes to interpret.", "INTERPRETATION_EMPTY_ANALYSIS", 422);
  }
  if (analysis.confidence.overall < 0.35) {
    throw new MusicInterpretationError("Pitch analysis confidence is too low for reliable interpretation.", "INTERPRETATION_LOW_CONFIDENCE", 422);
  }
}

function buildSummary(interpretation: Omit<MusicInterpretationResult, "recommendations" | "musicBrainHints">) {
  const topGenre = interpretation.genreConfidence[0]?.genre ?? "Unknown";
  return {
    concise: `${topGenre} leaning melody in ${interpretation.keyAnalysis.currentKey ?? "an unclear key"} ${interpretation.scaleAnalysis.currentScale ?? "mode"} with ${interpretation.groove.primary.toLowerCase()} groove and ${interpretation.emotion.primary.toLowerCase()} emotion.`,
    phrases: `${interpretation.phraseAnalysis.phrases.length} phrases with ${interpretation.phraseAnalysis.repeatedIdeas.length ? "repeated idea development" : "through-composed movement"}.`,
    groove: `${interpretation.groove.primary} feel, rhythmic density ${interpretation.performanceStatistics.rhythmicDensity.toFixed(2)} notes/sec, rests ${interpretation.performanceStatistics.restPercentage.toFixed(1)}%.`,
    harmony: `${interpretation.harmony.chordProgression.map((entry) => entry.romanNumeral).join(" - ")} with tonal center ${interpretation.harmony.tonalCenter ?? "unclear"}.`,
    production: `${interpretation.energy.level} energy, ${interpretation.complexity.level.toLowerCase()} melodic complexity, register ${interpretation.melodyAnalysis.register}.`,
  };
}

export class SupabaseInterpretationRepository implements InterpretationRepository {
  async getPitchAnalysis(userId: string, pitchAnalysisId: string): Promise<InterpretationSourceRecord> {
    const { data, error } = await requireSupabase().from("pitch_analysis").select("*").eq("id", pitchAnalysisId).eq("user_id", userId).single();
    if (error || !data) {
      throw new MusicInterpretationError("Pitch analysis not found.", "INTERPRETATION_SOURCE_NOT_FOUND", 404);
    }
    return mapPitch(data as PitchRow);
  }

  async createInterpretation(userId: string, source: InterpretationContext, interpretation: MusicInterpretationResult): Promise<MusicInterpretationRecord> {
    const { data, error } = await requireSupabase().from("music_interpretations").insert({
      user_id: userId,
      project_id: source.projectId,
      pitch_analysis_id: source.pitchAnalysisId,
      confidence: interpretation.overallConfidence,
      interpretation_json: interpretation,
      recommendations_json: interpretation.recommendations,
    }).select("*").single();
    if (error || !data) {
      throw new MusicInterpretationError(`Music interpretation could not be stored: ${error?.message ?? "unknown error"}`, "INTERPRETATION_DB_CREATE_FAILED", 502);
    }
    return mapRecord(data as InterpretationRow);
  }

  async getInterpretation(userId: string, interpretationId: string): Promise<MusicInterpretationRecord> {
    const { data, error } = await requireSupabase().from("music_interpretations").select("*").eq("id", interpretationId).eq("user_id", userId).single();
    if (error || !data) {
      throw new MusicInterpretationError("Music interpretation not found.", "INTERPRETATION_NOT_FOUND", 404);
    }
    return mapRecord(data as InterpretationRow);
  }

  async deleteInterpretation(userId: string, interpretationId: string): Promise<void> {
    const { error } = await requireSupabase().from("music_interpretations").delete().eq("id", interpretationId).eq("user_id", userId);
    if (error) {
      throw new MusicInterpretationError(`Music interpretation could not be deleted: ${error.message}`, "INTERPRETATION_DELETE_FAILED", 502);
    }
  }
}

export function interpretAnalysis(input: InterpretationInput): Promise<MusicInterpretationResult> {
  const { analysis, context } = input;
  ensureUsableAnalysis(analysis);

  const phraseAnalysis = analyzePhrases(analysis);
  const motifAnalysis = analyzeMotifs(analysis);
  const intervalAnalysis = analyzeIntervals(analysis);
  const rhythmAnalysis = analyzeRhythm(analysis);
  const melodyAnalysis = analyzeMelody(analysis, intervalAnalysis, motifAnalysis);
  const harmony = analyzeHarmony(analysis);
  const genreConfidence = analyzeGenres(analysis);
  const emotion = analyzeEmotion(analysis);
  const energy = analyzeEnergy(analysis);
  const groove = analyzeGroove(analysis);
  const scaleAnalysis = analyzeScale(analysis);
  const keyAnalysis = analyzeKey(analysis);
  const melodyStatistics = melodicStatistics(analysis, phraseAnalysis);
  const performanceStats = performanceStatistics(analysis, phraseAnalysis);
  const complexity = complexityScore(analysis, phraseAnalysis.phrases.length);

  const interpretationBase: Omit<MusicInterpretationResult, "recommendations" | "musicBrainHints"> = {
    source: {
      pitchAnalysisId: context.pitchAnalysisId,
      projectId: context.projectId,
      audioUploadId: context.audioUploadId,
      provider: context.provider,
    },
    musicalSummary: {
      concise: "",
      phrases: "",
      groove: "",
      harmony: "",
      production: "",
    },
    genreConfidence,
    emotion,
    energy,
    complexity: {
      level: complexity.level,
      score: complexity.score,
      confidence: Number((analysis.confidence.overall * 0.7 + 0.3).toFixed(3)),
      reasons: [
        `${melodyStatistics.uniqueNotes} unique notes across ${phraseAnalysis.phrases.length} phrases`,
        `Average interval ${melodyStatistics.averageInterval.toFixed(2)} semitones`,
        `${performanceStats.rhythmicDensity.toFixed(2)} notes per second`,
      ],
    },
    phraseAnalysis,
    motifAnalysis,
    intervalAnalysis,
    rhythmAnalysis,
    melodyAnalysis,
    harmony,
    groove,
    scaleAnalysis,
    keyAnalysis,
    variationAnalysis: [],
    melodyStatistics,
    performanceStatistics: performanceStats,
    scaleConfidence: scaleAnalysis.confidence,
    overallConfidence: Number((average([analysis.confidence.overall, analysis.estimatedKey.confidence, scaleAnalysis.confidence, keyAnalysis.confidence]) * 1).toFixed(3)),
  };

  interpretationBase.variationAnalysis = analyzeVariations(interpretationBase);
  interpretationBase.musicalSummary = buildSummary(interpretationBase);

  return buildRecommendations(interpretationBase).then((recommendations) => {
    const interpretation: MusicInterpretationResult = {
      ...interpretationBase,
      recommendations,
      musicBrainHints: {
        genre: interpretationBase.genreConfidence[0]?.genre ?? null,
        mood: interpretationBase.emotion.primary,
        tempo: recommendations.alternativeTempo ?? analysis.tempo.bpm ?? null,
        key: interpretationBase.keyAnalysis.currentKey,
        scale: interpretationBase.scaleAnalysis.currentScale,
        complexity: interpretationBase.complexity.level,
        style: `${interpretationBase.groove.primary} groove; ${interpretationBase.melodyAnalysis.descriptor.shape} ${interpretationBase.melodyAnalysis.descriptor.motion} melody; ${interpretationBase.harmony.chordProgression.map((entry) => entry.chordName).join(", ")}; ${interpretationBase.emotion.primary.toLowerCase()} emotion.`,
      },
    };
    return interpretation;
  });
}

export class MusicInterpretationService {
  constructor(private readonly repository: InterpretationRepository = new SupabaseInterpretationRepository()) {}

  async interpret(userId: string, request: MusicInterpretationRequest): Promise<MusicInterpretationRecord> {
    const resolved = request.pitchAnalysisId
      ? await this.repository.getPitchAnalysis(userId, request.pitchAnalysisId)
      : request.analysis
        ? {
            id: "inline",
            userId,
            projectId: request.projectId ?? null,
            analysis: request.analysis,
            estimatedBpm: request.analysis.tempo.bpm,
            estimatedKey: request.analysis.estimatedKey.key,
            estimatedScale: request.analysis.estimatedScale.scale,
            overallConfidence: request.analysis.confidence.overall,
            provider: request.analysis.recording.provider,
            audioUploadId: request.analysis.recording.audioUploadId,
          } satisfies InterpretationSourceRecord
        : null;
    if (!resolved) {
      throw new MusicInterpretationError("A pitch analysis id or pitch analysis payload is required.", "INTERPRETATION_INVALID_REQUEST", 422);
    }
    console.info("[music-interpretation] started", { userId, pitchAnalysisId: request.pitchAnalysisId ?? null, provider: resolved.provider, noteCount: resolved.analysis.detectedNotes.length });
    const interpretation = await interpretAnalysis({
      analysis: resolved.analysis,
      context: {
        projectId: resolved.projectId,
        pitchAnalysisId: request.pitchAnalysisId ?? null,
        audioUploadId: resolved.audioUploadId,
        provider: resolved.provider,
      },
    });
    const record = await this.repository.createInterpretation(userId, {
      projectId: resolved.projectId,
      pitchAnalysisId: request.pitchAnalysisId ?? null,
      audioUploadId: resolved.audioUploadId,
      provider: resolved.provider,
    }, interpretation);
    console.info("[music-interpretation] completed", { interpretationId: record.id, confidence: record.confidence, genre: interpretation.genreConfidence[0]?.genre ?? null });
    return record;
  }

  get(userId: string, interpretationId: string) {
    return this.repository.getInterpretation(userId, interpretationId);
  }

  remove(userId: string, interpretationId: string) {
    console.info("[music-interpretation] delete requested", { userId, interpretationId });
    return this.repository.deleteInterpretation(userId, interpretationId);
  }
}

export const musicInterpretationService = new MusicInterpretationService();