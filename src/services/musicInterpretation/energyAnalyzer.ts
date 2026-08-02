import type { PitchAnalysisResult } from "../pitch/types.js";
import type { EnergyResult } from "./types.js";

export function analyzeEnergy(analysis: PitchAnalysisResult): EnergyResult {
  const tempoFactor = Math.min(1, (analysis.tempo.bpm ?? 90) / 160);
  const densityFactor = Math.min(1, analysis.detectedNotes.length / Math.max(analysis.recording.durationSeconds * 8, 1));
  const rangeFactor = analysis.statistics.pitchRange.maxMidi !== null && analysis.statistics.pitchRange.minMidi !== null
    ? Math.min(1, (analysis.statistics.pitchRange.maxMidi - analysis.statistics.pitchRange.minMidi) / 18)
    : 0;
  const score = tempoFactor * 0.4 + densityFactor * 0.35 + rangeFactor * 0.15 + analysis.confidence.noteAverage * 0.1;
  const level = score < 0.2 ? "Very Low" : score < 0.4 ? "Low" : score < 0.65 ? "Medium" : score < 0.85 ? "High" : "Extreme";
  return {
    level,
    score: Number(score.toFixed(3)),
    confidence: Number((analysis.confidence.overall * 0.8 + 0.2).toFixed(3)),
  };
}