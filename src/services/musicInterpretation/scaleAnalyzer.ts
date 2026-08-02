import type { PitchAnalysisResult } from "../pitch/types.js";
import { MODE_PITCH_CLASSES, TONIC_NAMES } from "./constants.js";
import type { ScaleAnalysisResult } from "./types.js";

function tonicPitchClass(key: string | null) {
  if (!key) return null;
  const index = TONIC_NAMES.indexOf(key);
  return index >= 0 ? index : null;
}

function fitScore(pitchClasses: number[], target: number[]) {
  if (pitchClasses.length === 0) return 0;
  const hits = pitchClasses.filter((value) => target.includes(value)).length;
  return hits / pitchClasses.length;
}

export function analyzeScale(analysis: PitchAnalysisResult): ScaleAnalysisResult {
  const tonic = tonicPitchClass(analysis.estimatedKey.key);
  const observed = Array.from(new Set(analysis.detectedNotes.map((note) => note.midi % 12))).sort((left, right) => left - right);
  const currentScale = analysis.estimatedScale.scale ?? analysis.estimatedKey.scale;
  const currentTarget = tonic === null || !currentScale ? [] : (MODE_PITCH_CLASSES[currentScale] ?? MODE_PITCH_CLASSES.major).map((pitchClass) => (pitchClass + tonic) % 12);
  const currentConfidence = fitScore(observed, currentTarget);
  const alternatives = Object.entries(MODE_PITCH_CLASSES)
    .map(([name, profile]) => ({ name, score: tonic === null ? 0 : fitScore(observed, profile.map((pitchClass) => (pitchClass + tonic) % 12)) }))
    .filter((entry) => entry.name !== currentScale)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((entry) => entry.name);
  return {
    currentScale: currentScale ?? null,
    confidence: Number(currentConfidence.toFixed(3)),
    alternatives,
  };
}