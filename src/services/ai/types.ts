import { z } from "zod";
import { orchestrationSchema } from "../../domain/music.js";
import type { MusicContext } from "../musicBrain/index.js";
import type { MusicInterpretationRecord } from "../musicInterpretation/index.js";

export const aiNoteEventSchema = z.object({
  pitch: z.number().int().min(0).max(127),
  startBeat: z.number().min(0).max(2048),
  durationBeats: z.number().positive().max(64),
  velocity: z.number().int().min(1).max(127),
});

export const aiChordSchema = z.object({
  symbol: z.string().min(1).max(24),
  romanNumeral: z.string().min(1).max(12),
  startBar: z.number().int().min(1).max(256),
  bars: z.number().int().min(1).max(32),
  function: z.string().min(1).max(48),
});

export const aiArrangementSectionSchema = z.object({
  name: z.string().min(1).max(40),
  bars: z.number().int().min(1).max(64),
  elements: z.array(z.string().min(1).max(40)).max(12),
});

export const aiCompositionSchema = z.object({
  genre: z.string().min(1).max(80),
  mood: z.string().min(1).max(80),
  tempo: z.number().int().min(40).max(240),
  key: z.string().min(1).max(12),
  scale: z.string().min(1).max(40),
  timeSignature: z.tuple([z.number().int().min(1).max(12), z.number().int().min(1).max(16)]),
  trackName: z.string().min(1).max(80),
  melody: z.array(aiNoteEventSchema).min(1).max(2048),
  chordProgression: z.array(aiChordSchema).min(1).max(64),
  bassline: z.array(aiNoteEventSchema).max(2048),
  counterMelody: z.array(aiNoteEventSchema).max(2048),
  arrangement: z.array(aiArrangementSectionSchema).min(1).max(24),
  pluginCategories: z.array(z.string().min(1).max(80)).max(16),
  productionNotes: z.array(z.string().min(1).max(280)).max(16),
  variationSuggestions: z.array(z.string().min(1).max(200)).max(12),
  confidence: z.number().min(0).max(1),
});

export type AiComposition = z.infer<typeof aiCompositionSchema>;
export type AiResponsePayload = unknown;

export type AiRequestStatus = "processing" | "completed" | "failed" | "retrying";
export type MembershipTier = "free" | "pro";

export const aiGenerateInputSchema = orchestrationSchema.extend({
  musicInterpretationId: z.string().uuid().optional(),
  requestedTracks: z.array(z.object({ name: z.string().max(80), instrument: z.string().max(80).optional(), role: z.string().max(80).optional(), instruction: z.string().max(240).optional() })).max(24).optional(),
  userPreferences: z.object({
    arrangementFocus: z.string().max(120).optional(),
    preferredInstruments: z.array(z.string().max(80)).max(12).optional(),
    avoidInstruments: z.array(z.string().max(80)).max(12).optional(),
    mixNotes: z.string().max(240).optional(),
  }).optional(),
  forceRefresh: z.boolean().default(false),
});

export type AiGenerateInput = z.infer<typeof aiGenerateInputSchema>;

export const aiRetryInputSchema = z.object({
  requestId: z.string().uuid(),
  forceRetry: z.boolean().default(false),
});

export type AiRetryInput = z.infer<typeof aiRetryInputSchema>;

export interface AiProviderUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AiProviderResponse {
  content: string;
  model: string;
  usage: AiProviderUsage;
  responseTimeMs: number;
  providerStatus: number;
}

export interface AiProviderPort {
  generate(prompt: string, options: { model: string; signal: AbortSignal }): Promise<AiProviderResponse>;
}

export interface ModelSelectionResult {
  membership: MembershipTier;
  primaryModel: string;
  fallbackModel: string | null;
}

export interface BuiltAiContext {
  prompt: string;
  sanitizedPrompt: string;
  musicBrain: { context: MusicContext; providerPrompt: string };
  interpretation: MusicInterpretationRecord | null;
  artist: {
    translatedGenre: string;
    translatedMood: string[];
    translatedTempo: number | null;
    translatedInstruments: string[];
    grooveStyle: string;
    melodyStyle: string;
    productionStyle: string;
    originalityNotice: string;
    sanitizedPrompt: string;
    knowledgeGenre: string;
  };
  knowledge: Array<{
    genre: { name: string };
    tempo: { minBpm: number; maxBpm: number; defaultBpm: number };
    scales: Array<{ name: string }>;
    keys: Array<{ name: string }>;
    chordProgressions: Array<{ romanNumerals: string[]; exampleKey: string }>;
    instruments: Array<{ name: string; category: string }>;
    plugins: Array<{ category: string; description: string }>;
  }>;
  projectHistory: string[];
  userPreferences: AiGenerateInput["userPreferences"];
}

export interface AssembledPrompt {
  prompt: string;
  cacheKeyMaterial: string;
}

export interface CachedAiResponse {
  response: AiResponsePayload;
  model: string;
  promptHash: string;
  expiresAt: string;
}

export interface AiUsageSnapshot {
  tier: MembershipTier;
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
}

export interface AiGenerateResult {
  id: string;
  cached: boolean;
  model: string;
  fallbackUsed: boolean;
  response: AiResponsePayload;
  tempoAdvisory?: string | null;
  usage: AiProviderUsage;
  responseTimeMs: number;
  promptHash: string;
}

export interface AiRequestRecord {
  id: string;
  userId: string;
  promptHash: string;
  model: string;
  fallbackModel: string | null;
  requestPayload: AiGenerateInput;
  responsePayload: AiResponsePayload | null;
  status: AiRequestStatus;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  responseTimeMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiContextRepository {
  latestInterpretationForProject(userId: string, projectId: string): Promise<MusicInterpretationRecord | null>;
  interpretationById(userId: string, interpretationId: string): Promise<MusicInterpretationRecord>;
  projectMessages(userId: string, projectId: string): Promise<string[]>;
}

export interface AiRequestRepository {
  createRequest(userId: string, promptHash: string, model: string, fallbackModel: string | null, input: AiGenerateInput): Promise<AiRequestRecord>;
  completeRequest(requestId: string, output: { model: string; response: AiResponsePayload; usage: AiProviderUsage; responseTimeMs: number; status?: AiRequestStatus }): Promise<AiRequestRecord>;
  failRequest(requestId: string, error: { code: string; message: string; responseTimeMs?: number; status?: AiRequestStatus }): Promise<AiRequestRecord>;
  history(userId: string): Promise<AiRequestRecord[]>;
  byId(userId: string, requestId: string): Promise<AiRequestRecord>;
  usage(userId: string): Promise<{ date: string; requests: number; promptTokens: number; completionTokens: number; totalTokens: number; averageResponseMs: number; errors: number }[]>;
  adminOverview(): Promise<{ dailyRequests: number; averageResponseTimeMs: number; errorRate: number; topUsers: Array<{ userId: string; requests: number; totalTokens: number }>; modelStats: Array<{ model: string; requests: number; averageResponseTimeMs: number; errors: number; fallbacks: number }> }>;
}

export class AiOrchestrationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "AiOrchestrationError";
  }
}