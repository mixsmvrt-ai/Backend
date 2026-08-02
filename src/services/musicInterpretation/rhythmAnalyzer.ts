import type { PitchAnalysisResult } from "../pitch/types.js";
import type { RhythmAnalysisResult } from "./types.js";

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function analyzeRhythm(analysis: PitchAnalysisResult): RhythmAnalysisResult {
  const durationSeconds = Math.max(analysis.recording.durationSeconds, 0.001);
  const restSeconds = analysis.silenceRegions.reduce((sum, region) => sum + region.duration, 0);
  const averageDuration = average(analysis.detectedNotes.map((note) => note.duration));
  const beatPeriod = analysis.tempo.bpm ? 60 / analysis.tempo.bpm : null;
  const syncopation = beatPeriod === null
    ? 0
    : average(analysis.timing.onsetTimes.map((onset) => {
      const nearestBeat = Math.round(onset / beatPeriod) * beatPeriod;
      return Math.min(1, Math.abs(onset - nearestBeat) / Math.max(beatPeriod / 2, 0.001));
    }));
  const beatAlignment = 1 - syncopation;
  return {
    rhythmicDensity: Number((analysis.detectedNotes.length / durationSeconds).toFixed(3)),
    averageDuration: Number(averageDuration.toFixed(3)),
    restPercentage: Number(((restSeconds / durationSeconds) * 100).toFixed(2)),
    syncopation: Number(syncopation.toFixed(3)),
    beatAlignment: Number(beatAlignment.toFixed(3)),
    swing: Number((analysis.tempo.swingEstimate ?? 0).toFixed(3)),
  };
}