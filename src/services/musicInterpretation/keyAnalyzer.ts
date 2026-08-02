import type { PitchAnalysisResult } from "../pitch/types.js";
import { TONIC_NAMES } from "./constants.js";
import type { KeyAnalysisResult } from "./types.js";

function tonicScores(analysis: PitchAnalysisResult) {
  const scores = new Array(12).fill(0);
  for (const note of analysis.detectedNotes) {
    scores[note.midi % 12] += note.duration * note.confidence;
  }
  return scores;
}

export function analyzeKey(analysis: PitchAnalysisResult): KeyAnalysisResult {
  const scores = tonicScores(analysis);
  const ranked = scores.map((score, index) => ({ key: TONIC_NAMES[index], score })).sort((left, right) => right.score - left.score);
  const total = scores.reduce((sum, score) => sum + score, 0) || 1;
  return {
    currentKey: analysis.estimatedKey.key ?? ranked[0]?.key ?? null,
    confidence: Number(((ranked[0]?.score ?? 0) / total).toFixed(3)),
    alternatives: ranked.slice(1, 4).map((entry) => entry.key),
  };
}