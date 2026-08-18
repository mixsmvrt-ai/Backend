import { z } from "zod";

export const plannerWorkflowValues = ["text_to_midi", "song_pack", "voice_to_midi"] as const;
export type PlannerWorkflow = (typeof plannerWorkflowValues)[number];

export const compactNoteSchema = z.object({
  p: z.number().int().min(0).max(127),
  s: z.number().min(0).max(512),
  d: z.number().positive().max(64),
  v: z.number().int().min(1).max(127),
});

const compactTrackInputSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  n: z.string().min(1).max(80).optional(),
  instrument: z.string().min(1).max(80).optional(),
  i: z.string().min(1).max(80).optional(),
  role: z.string().min(1).max(80).optional(),
  r: z.string().min(1).max(80).optional(),
  notes: z.array(compactNoteSchema).min(1).max(4096),
});

const compactPlanInputSchema = z.object({
  genre: z.string().max(120).optional(),
  mood: z.string().max(120).optional(),
  tempo: z.number().int().min(40).max(240),
  key: z.string().min(1).max(24),
  scale: z.string().min(1).max(40),
  bars: z.number().int().min(1).max(256),
  time_signature: z.string().regex(/^\d+\/\d+$/).optional(),
  ts: z.string().regex(/^\d+\/\d+$/).optional(),
  tracks: z.array(compactTrackInputSchema).min(1).max(24),
  summary: z.string().max(300).optional(),
});

export interface CompactTrackPlan {
  name: string;
  instrument: string;
  role: string;
  notes: Array<{ p: number; s: number; d: number; v: number }>;
}

export interface CompactMusicPlan {
  genre: string;
  mood: string;
  tempo: number;
  key: string;
  scale: string;
  bars: number;
  timeSignature: [number, number];
  tracks: CompactTrackPlan[];
  summary: string;
}

export interface CompactPlannerResult {
  id: string;
  cached: boolean;
  model: string;
  fallbackUsed: boolean;
  promptHash: string;
  responseTimeMs: number;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  plan: CompactMusicPlan;
  tempoAdvisory?: string | null;
}

export type OrchestratorSettings = {
  enabled: boolean;
  defaultModel: string | null;
  temperature: number;
  maxOutputTokens: number;
  jsonValidationStrictness: "strict" | "relaxed";
  cacheDurationSeconds: number;
  baselineLegacyTokensPerRequest: number;
};

export function normalizeCompactPlan(value: unknown): CompactMusicPlan {
  const parsed = compactPlanInputSchema.parse(value);
  const signature = parsed.time_signature ?? parsed.ts ?? "4/4";
  const [top, bottom] = signature.split("/").map(Number);
  return {
    genre: parsed.genre ?? "Unspecified",
    mood: parsed.mood ?? "Balanced",
    tempo: parsed.tempo,
    key: parsed.key,
    scale: parsed.scale,
    bars: parsed.bars,
    timeSignature: [top, bottom] as [number, number],
    tracks: parsed.tracks.map((track, index) => ({
      name: track.name ?? track.n ?? `Track ${index + 1}`,
      instrument: track.instrument ?? track.i ?? "Instrument",
      role: track.role ?? track.r ?? `track_${index + 1}`,
      notes: track.notes.map((note) => ({
        p: note.p,
        s: Number(note.s.toFixed(4)),
        d: Number(note.d.toFixed(4)),
        v: note.v,
      })),
    })),
    summary: parsed.summary ?? "Compact music plan generated.",
  };
}