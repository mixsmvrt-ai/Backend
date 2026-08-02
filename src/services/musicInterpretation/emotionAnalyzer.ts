import type { PitchAnalysisResult } from "../pitch/types.js";
import type { EmotionResult } from "./types.js";

function rank(scores: Record<EmotionResult["primary"], number>) {
  return Object.entries(scores).sort((left, right) => right[1] - left[1]) as Array<[EmotionResult["primary"], number]>;
}

export function analyzeEmotion(analysis: PitchAnalysisResult) {
  const scale = analysis.estimatedScale.scale ?? "major";
  const tempo = analysis.tempo.bpm ?? 100;
  const density = analysis.detectedNotes.length / Math.max(analysis.recording.durationSeconds, 1);
  const leapScore = analysis.melody.intervals.filter((interval) => Math.abs(interval) >= 7).length / Math.max(analysis.melody.intervals.length, 1);
  const scores = {
    Dark: (scale.includes("minor") ? 0.3 : 0.05) + leapScore * 0.2 + (tempo < 110 ? 0.12 : 0),
    Happy: (scale.includes("major") ? 0.28 : 0.04) + (tempo >= 105 ? 0.12 : 0) + density * 0.03,
    Sad: (scale.includes("minor") ? 0.25 : 0.02) + (tempo < 90 ? 0.16 : 0) + analysis.statistics.repeatedNoteRatio * 0.1,
    Aggressive: (tempo > 130 ? 0.2 : 0.05) + leapScore * 0.24 + density * 0.05,
    Hopeful: (scale.includes("major") ? 0.18 : 0.06) + (analysis.estimatedKey.confidence > 0.6 ? 0.1 : 0),
    Epic: (analysis.statistics.pitchRange.maxMidi !== null && analysis.statistics.pitchRange.minMidi !== null && analysis.statistics.pitchRange.maxMidi - analysis.statistics.pitchRange.minMidi > 12 ? 0.22 : 0.08) + (tempo >= 100 ? 0.12 : 0),
    Dreamy: (analysis.tempo.swingEstimate !== null && analysis.tempo.swingEstimate > 0.56 ? 0.1 : 0.04) + (tempo < 105 ? 0.12 : 0) + (analysis.statistics.averageNoteDuration > 0.35 ? 0.1 : 0),
    Melancholy: (scale.includes("minor") ? 0.24 : 0.06) + (tempo < 105 ? 0.08 : 0) + (analysis.statistics.repeatedNoteRatio > 0.2 ? 0.08 : 0),
    Relaxed: (tempo < 98 ? 0.22 : 0.04) + (density < 4 ? 0.15 : 0.02) + (analysis.tempo.swingEstimate !== null && analysis.tempo.swingEstimate > 0.54 ? 0.08 : 0),
  };
  const ordered = rank(scores);
  return {
    primary: ordered[0][0],
    secondary: ordered[1]?.[0] ?? null,
    confidence: Number(Math.min(1, ordered[0][1]).toFixed(3)),
    palette: ordered.slice(0, 4).map((entry) => entry[0]),
  } satisfies EmotionResult;
}