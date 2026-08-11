import { z } from "zod";

export const refinementAnswerSchema = z.object({ category: z.string().min(1).max(40), value: z.string().trim().min(1).max(80) });
export const promptRefinementInputSchema = z.object({
  prompt: z.string().trim().min(3).max(1000),
  kind: z.enum(["melody", "chords", "counter_melody", "bassline", "drums", "full_composition"]).optional(),
});

export type RefinementCategory = "mood" | "instrument" | "tempo" | "energy" | "density" | "complexity" | "include";
export type RefinementAnswer = z.infer<typeof refinementAnswerSchema>;
export type RefinementQuestion = { id: RefinementCategory; label: string; prompt: string; options: string[] };
export type PromptMemory = { genre?: string | null; mood?: string | null; bpm?: number | null; key?: string | null; instrument?: string | null; complexity?: string | null };

export type PromptRefinementResult = {
  confidence: number;
  shouldGenerate: boolean;
  intro: string;
  questions: RefinementQuestion[];
  detected: { genre?: string; subgenre?: string; artist?: string; instrument?: string; mood?: string; tempo?: number; key?: string; complexity?: string };
};

const moods = ["Aggressive", "Emotional", "Haunting", "Melancholic", "Cinematic", "Romantic", "Uplifting", "Dark", "Moody", "Atmospheric"];
const instruments = ["Dark Piano", "Soft Piano", "Spanish Guitar", "Electric Guitar", "Bell", "Pad", "Strings", "Pluck", "Synth", "808", "Bass"];
const energy = ["Minimal", "Bouncy", "Hard", "Emotional", "Cinematic", "Heavy", "Atmospheric"];
const density = ["Sparse", "Balanced", "Busy"];
const complexity = ["Simple", "Modern", "Cinematic", "Emotional"];

function firstMatch(text: string, entries: Array<[RegExp, string]>) {
  return entries.find(([pattern]) => pattern.test(text))?.[1];
}

function detect(prompt: string, memory: PromptMemory) {
  const text = prompt.toLowerCase();
  const artist = firstMatch(text, [[/\bkraff\b/, "Kraff"], [/\b(popcaan|vybz kartel|alkaline)\b/, "artist"]]);
  const genre = firstMatch(text, [[/trap\s*dancehall|dancehall\s*trap/, "Trap Dancehall"], [/\bdancehall|riddim|jamaican/, "Dancehall"], [/\bafro\s*beats?/, "Afrobeats"], [/\bdrill\b/, "Drill"], [/\br&b|rnb/, "R&B"], [/\btrap\b/, "Trap"]]) ?? memory.genre ?? undefined;
  const subgenre = /trap\s*dancehall|dancehall\s*trap/.test(text) ? "Trap Dancehall" : genre;
  const instrument = firstMatch(text, [[/dark\s*piano/, "Dark Piano"], [/soft\s*piano|\bpiano\b|keys?/, "Soft Piano"], [/spanish|flamenco|nylon|guitar/, "Spanish Guitar"], [/electric\s*guitar/, "Electric Guitar"], [/bell|chime|mallet/, "Bell"], [/\bpad\b|ambient/, "Pad"], [/strings?|orchestral/, "Strings"], [/pluck|plucky/, "Pluck"], [/\bsynth|lead\b/, "Synth"], [/\b808\b/, "808"], [/\bbass|sub\b/, "Bass"]]) ?? memory.instrument ?? undefined;
  const mood = firstMatch(text, moods.map((value) => [new RegExp(`\\b${value.toLowerCase()}\\b`), value] as [RegExp, string])) ?? memory.mood ?? undefined;
  const tempoMatch = text.match(/\b([4-9]\d|1\d\d|2[0-4]\d)\s*(?:bpm|beats?)?\b/);
  const tempo = tempoMatch ? Number(tempoMatch[1]) : memory.bpm ?? undefined;
  const key = text.match(/\b([a-g](?:#|b)?)\s*(major|minor|maj|min)\b/i)?.[0] ?? memory.key ?? undefined;
  const detectedComplexity = firstMatch(text, [[/\bsimple|basic|simple chords?\b/, "Simple"], [/\bmodern|rich|colorful\b/, "Modern"], [/\bcinematic|orchestral\b/, "Cinematic"], [/\bemotional chords?\b/, "Emotional"]]) ?? memory.complexity ?? undefined;
  return { genre, subgenre, artist, instrument, mood, tempo, key, complexity: detectedComplexity };
}

function tempoOptions(genre?: string) {
  if (genre === "Drill") return ["135 BPM", "140 BPM", "145 BPM"];
  if (genre === "R&B") return ["70 BPM", "80 BPM", "90 BPM", "95 BPM"];
  if (genre === "Afrobeats") return ["95 BPM", "100 BPM", "105 BPM", "108 BPM"];
  return ["95 BPM", "100 BPM", "105 BPM", "110 BPM"];
}

function questionFor(category: RefinementCategory, detected: ReturnType<typeof detect>): RefinementQuestion {
  if (category === "instrument") {
    const options = detected.artist ? ["Spanish Guitar", "Dark Piano", "Bell"] : detected.genre === "Afrobeats" ? ["Spanish Guitar", "Soft Piano", "Pluck"] : instruments.slice(0, 4);
    return { id: category, label: "Instrument", prompt: detected.artist ? "Closer to which sound?" : "Which instrument should lead?", options };
  }
  if (category === "tempo") return { id: category, label: "Tempo", prompt: "What pocket should it sit in?", options: tempoOptions(detected.genre) };
  if (category === "energy") return { id: category, label: "Energy", prompt: "How should it move?", options: energy.slice(0, 4) };
  if (category === "density") return { id: category, label: "Melody density", prompt: "How much space should I leave?", options: density };
  if (category === "complexity") return { id: category, label: "Chord color", prompt: "How should the harmony feel?", options: complexity };
  if (category === "include") return { id: category, label: "Include", prompt: "What should the pack include?", options: ["Melody + Chords", "Melody + Chords + Bass", "Full Pack"] };
  return { id: "mood", label: "Mood", prompt: "What emotional direction should I lock in?", options: moods.slice(0, 5) };
}

export class PromptRefinementEngine {
  refine(prompt: string, memory: PromptMemory = {}, kind?: string): PromptRefinementResult {
    const detected = detect(prompt, memory);
    const fields = [detected.genre, detected.subgenre, detected.instrument, detected.artist, detected.mood, detected.tempo, detected.key, detected.complexity].filter(Boolean).length;
    const confidence = Math.min(1, Number((fields / 8).toFixed(2)));
    if (confidence >= 0.88) return { confidence, shouldGenerate: true, intro: "I have the direction. Generating it now.", questions: [], detected };

    const missing: RefinementCategory[] = [];
    if (!detected.mood) missing.push("mood");
    if (!detected.instrument && kind !== "drums") missing.push("instrument");
    if (!detected.tempo) missing.push("tempo");
    if (kind === "song_pack" || /song\s*pack|pack/.test(prompt.toLowerCase())) missing.push("include");
    if (!detected.complexity && /chord|harmony|progression/.test(prompt.toLowerCase())) missing.push("complexity");
    if (!missing.length) missing.push("energy");
    const limit = confidence < 0.45 ? 3 : confidence < 0.7 ? 2 : 1;
    const questions = missing.slice(0, limit).map((category) => questionFor(category, detected));
    return { confidence, shouldGenerate: questions.length === 0, intro: questions.length === 1 ? "One quick question before I build this." : "Let’s lock in the vibe first. A few quick questions will help me get it right.", questions, detected };
  }
}

export const promptRefinementEngine = new PromptRefinementEngine();
