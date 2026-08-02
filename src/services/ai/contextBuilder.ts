import { requireSupabase } from "../../config/supabase.js";
import { validatePrompt } from "../musicBrain/validation.js";
import type { MusicBrainInput } from "../musicBrain/index.js";
import { musicBrainService } from "../musicBrain/index.js";
import { recommendationKnowledgeService } from "../musicKnowledge/recommendation.service.js";
import { artistInspirationService } from "../artistInspiration/index.js";
import type { MusicInterpretationRecord } from "../musicInterpretation/index.js";
import type { AiContextRepository, AiGenerateInput, BuiltAiContext } from "./types.js";
import { DEFAULT_PROMPT_HISTORY_LIMIT, PROMPT_INJECTION_PATTERNS } from "./constants.js";
import { AiOrchestrationError } from "./types.js";

type InterpretationRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  pitch_analysis_id: string | null;
  confidence: number;
  interpretation_json: MusicInterpretationRecord["interpretation"];
  recommendations_json: MusicInterpretationRecord["recommendations"];
  created_at: string;
};

function mapInterpretation(row: InterpretationRow): MusicInterpretationRecord {
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

function sanitizeForAi(prompt: string) {
  const normalized = validatePrompt(prompt);
  if (PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(normalized))) {
    throw new AiOrchestrationError("Prompt contains unsupported control instructions.", "AI_PROMPT_INJECTION_BLOCKED", 422);
  }
  return normalized;
}

export class SupabaseAiContextRepository implements AiContextRepository {
  async latestInterpretationForProject(userId: string, projectId: string): Promise<MusicInterpretationRecord | null> {
    const { data, error } = await requireSupabase().from("music_interpretations").select("*").eq("user_id", userId).eq("project_id", projectId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new AiOrchestrationError(`Unable to load project interpretation: ${error.message}`, "AI_CONTEXT_LOAD_FAILED", 502);
    return data ? mapInterpretation(data as InterpretationRow) : null;
  }

  async interpretationById(userId: string, interpretationId: string): Promise<MusicInterpretationRecord> {
    const { data, error } = await requireSupabase().from("music_interpretations").select("*").eq("user_id", userId).eq("id", interpretationId).single();
    if (error || !data) throw new AiOrchestrationError("Music interpretation not found.", "AI_INTERPRETATION_NOT_FOUND", 404);
    return mapInterpretation(data as InterpretationRow);
  }

  async projectMessages(userId: string, projectId: string): Promise<string[]> {
    const { data, error } = await requireSupabase().from("project_messages").select("role, content").eq("project_id", projectId).eq("user_id", userId).order("created_at", { ascending: false }).limit(DEFAULT_PROMPT_HISTORY_LIMIT);
    if (error) throw new AiOrchestrationError(`Unable to load project history: ${error.message}`, "AI_CONTEXT_LOAD_FAILED", 502);
    return (data ?? []).reverse().map((entry) => `${entry.role}: ${sanitizeForAi(entry.content)}`);
  }
}

export class ContextBuilder {
  constructor(private readonly repository: AiContextRepository = new SupabaseAiContextRepository()) {}

  async build(userId: string, input: AiGenerateInput): Promise<BuiltAiContext> {
    const sanitizedPrompt = sanitizeForAi(input.prompt);
    const interpretation = input.musicInterpretationId
      ? await this.repository.interpretationById(userId, input.musicInterpretationId)
      : input.projectId
        ? await this.repository.latestInterpretationForProject(userId, input.projectId)
        : null;
    const artist = await artistInspirationService.analyze({ prompt: sanitizedPrompt, userId });
    const projectHistory = input.projectId ? await this.repository.projectMessages(userId, input.projectId) : [];
    const contextualPrompt = projectHistory.length
      ? `Project conversation so far:\n${projectHistory.join("\n")}\n\nLatest direction: ${artist.sanitizedPrompt}`
      : artist.sanitizedPrompt;
    const hints = interpretation?.interpretation.musicBrainHints;
    const brainInput: MusicBrainInput = {
      ...input,
      prompt: contextualPrompt,
      genre: input.genre ?? hints?.genre ?? artist.knowledgeGenre,
      mood: input.mood ?? hints?.mood ?? artist.translatedMood[0],
      tempo: input.tempo ?? hints?.tempo ?? artist.translatedTempo ?? undefined,
      key: input.key ?? hints?.key ?? undefined,
      scale: input.scale ?? hints?.scale ?? undefined,
      complexity: input.complexity ?? hints?.complexity?.toLowerCase(),
      style: [
        hints?.style,
        `Generalized artist inspiration: genre=${artist.translatedGenre}; groove=${artist.grooveStyle}; melody=${artist.melodyStyle}; production=${artist.productionStyle}; instruments=${artist.translatedInstruments.join(", ")}; moods=${artist.translatedMood.join(", ")}.`,
      ].filter(Boolean).join(" "),
      originalityNotice: artist.originalityNotice,
    };
    const musicBrain = await musicBrainService.prepare(brainInput);
    const knowledge = await recommendationKnowledgeService.recommend({
      genre: musicBrain.context.genre,
      mood: musicBrain.context.mood,
      energy: musicBrain.context.energy,
      tonality: musicBrain.context.scale,
      instrument: musicBrain.context.instrumentSuggestions[0],
    });
    return {
      prompt: contextualPrompt,
      sanitizedPrompt,
      musicBrain,
      interpretation,
      artist,
      knowledge: knowledge.map((entry) => ({
        genre: { name: entry.genre.name },
        tempo: { minBpm: entry.tempo.minBpm, maxBpm: entry.tempo.maxBpm, defaultBpm: entry.tempo.defaultBpm },
        scales: entry.scales.map((scale) => ({ name: scale.name })),
        keys: entry.keys.map((key) => ({ name: key.name })),
        chordProgressions: entry.chordProgressions.map((progression) => ({ romanNumerals: progression.romanNumerals, exampleKey: progression.exampleKey })),
        instruments: entry.instruments.map((instrument) => ({ name: instrument.name, category: instrument.category })),
        plugins: entry.plugins.map((plugin) => ({ category: plugin.category, description: plugin.description })),
      })),
      projectHistory,
      userPreferences: input.userPreferences,
    };
  }
}

export const contextBuilder = new ContextBuilder();