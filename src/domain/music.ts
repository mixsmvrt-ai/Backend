import { z } from "zod";
import { midiOptionsSchema } from "../services/midiGeneration/types.js";

export const generationKinds = ["melody", "chords", "counter_melody", "bassline", "drums", "full_composition"] as const;

export const generationSchema = z.object({
  prompt: z.string().trim().min(3).max(1000),
  kind: z.enum(generationKinds).default("melody"),
  genre: z.string().max(80).optional(),
  mood: z.string().max(80).optional(),
  scale: z.string().max(40).optional(),
  key: z.string().max(12).optional(),
  tempo: z.number().int().min(40).max(240).optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  targetDaw: z.string().max(80).optional(),
  pluginSuggestions: z.boolean().default(false),
});

export type GenerationInput = z.infer<typeof generationSchema>;
export type GenerationStatus = "queued" | "processing" | "completed" | "failed";

export interface Generation {
  id: string;
  status: GenerationStatus;
  prompt: string;
  kind: string;
  createdAt: string;
  fileName?: string;
}

export const noteSchema = z.object({
  pitch: z.number().int().min(0).max(127),
  startBeat: z.number().min(0),
  durationBeats: z.number().positive().max(16),
  velocity: z.number().int().min(1).max(127),
});

export const structuredMusicSchema = z.object({
  tempo: z.number().int().min(40).max(240),
  key: z.string().min(1).max(24),
  scale: z.string().min(1).max(40),
  timeSignature: z.tuple([z.number().int().min(1).max(12), z.number().int().min(1).max(16)]),
  trackName: z.string().min(1).max(80),
  notes: z.array(noteSchema).min(1).max(2048),
  chordProgression: z.array(z.string().min(1).max(24)).max(32),
  structure: z.array(z.object({ name: z.string().min(1).max(40), bars: z.number().int().min(1).max(64) })).min(1).max(16),
  pluginRecommendations: z.array(z.object({
    instrumentType: z.string().min(1).max(80),
    presetType: z.string().min(1).max(80),
    genreMatch: z.string().max(80),
    moodMatch: z.string().max(80),
    alternative: z.string().max(120),
  })).max(8),
});

export const orchestrationSchema = generationSchema.extend({
  projectId: z.string().uuid().optional(),
  workflow: z.enum(["text_to_midi", "song_pack", "voice_to_midi"]).optional(),
  lengthBars: z.number().int().min(1).max(128).default(16),
  complexity: z.enum(["low", "medium", "high"]).default("medium"),
  variationAmount: z.number().min(0).max(1).default(0.5),
  randomSeed: z.number().int().min(0).max(2147483647).optional(),
  timeSignature: z.tuple([z.number().int().min(1).max(12), z.number().int().min(1).max(16)]).default([4, 4]),
  midiOptions: midiOptionsSchema.optional(),
});

export type OrchestrationInput = z.infer<typeof orchestrationSchema>;
export type StructuredMusic = z.infer<typeof structuredMusicSchema>;
