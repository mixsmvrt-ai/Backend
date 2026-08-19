import type { OrchestrationInput, StructuredMusic } from "../domain/music.js";
import type { RetrievedReference } from "./referenceLibrary/service.js";

export type ReferenceQualityMetrics = {
  noteCount: number;
  noteDensity: number;
  pitchRange: number;
  restRatio: number;
  activeBars: number;
  velocityVariation: number;
};

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function metrics(music: StructuredMusic, lengthBars: number): ReferenceQualityMetrics {
  const beats = Math.max(1, lengthBars * music.timeSignature[0]);
  const notes = music.notes;
  const pitches = notes.map((note) => note.pitch);
  const totalDuration = notes.reduce((sum, note) => sum + note.durationBeats, 0);
  const meanVelocity = notes.reduce((sum, note) => sum + note.velocity, 0) / Math.max(1, notes.length);
  const variance = notes.reduce((sum, note) => sum + ((note.velocity - meanVelocity) ** 2), 0) / Math.max(1, notes.length);
  return {
    noteCount: notes.length,
    noteDensity: round(notes.length / beats),
    pitchRange: pitches.length ? Math.max(...pitches) - Math.min(...pitches) : 0,
    restRatio: round(Math.max(0, 1 - (totalDuration / beats))),
    activeBars: new Set(notes.map((note) => Math.floor(note.startBeat / music.timeSignature[0]) + 1)).size,
    velocityVariation: round(Math.sqrt(variance) / 127),
  };
}

function userRequestsComplexity(prompt: string) {
  return /\b(complex|complicated|busy|dense|advanced|more detail)\b/i.test(prompt);
}

function simplifyNotes(music: StructuredMusic, maximum: number) {
  if (music.notes.length <= maximum) return music;
  const sorted = [...music.notes].sort((left, right) => left.startBeat - right.startBeat || left.pitch - right.pitch);
  const step = (sorted.length - 1) / Math.max(1, maximum - 1);
  const selected = Array.from({ length: maximum }, (_, index) => sorted[Math.round(index * step)]).filter((note, index, values) => values.indexOf(note) === index);
  return { ...music, notes: selected };
}

export function applyReferenceQualityGate(music: StructuredMusic, reference: RetrievedReference | undefined, input: OrchestrationInput) {
  if (!reference || userRequestsComplexity(input.prompt) || input.complexity === "high") {
    return { music, before: metrics(music, input.lengthBars), after: metrics(music, input.lengthBars), simplified: false };
  }
  const before = metrics(music, input.lengthBars);
  const referenceCount = Math.max(1, reference.midiEvents.length);
  const allowedCount = Math.max(8, Math.ceil(referenceCount * (1 + (input.variationAmount * 0.75))));
  const densityLimit = Math.max(0.5, reference.profile.noteDensity * 1.75);
  const shouldSimplify = before.noteCount > allowedCount || before.noteDensity > densityLimit;
  const gated = shouldSimplify ? simplifyNotes(music, allowedCount) : music;
  return { music: gated, before, after: metrics(gated, input.lengthBars), simplified: gated !== music };
}

export function referenceQualityMetrics(music: StructuredMusic, lengthBars: number) {
  return metrics(music, lengthBars);
}
