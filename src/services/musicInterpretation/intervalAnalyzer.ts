import type { PitchAnalysisResult } from "../pitch/types.js";
import type { IntervalAnalysisResult } from "./types.js";
import { averageInterval, largestLeap } from "./statistics.js";

export function analyzeIntervals(analysis: Pick<PitchAnalysisResult, "detectedNotes" | "melody">): IntervalAnalysisResult {
  const intervals = analysis.melody.intervals;
  const ascendingIntervals = intervals.filter((interval) => interval > 0);
  const descendingIntervals = intervals.filter((interval) => interval < 0).map(Math.abs);
  const repeatedNotes = intervals.filter((interval) => interval === 0).length;
  const largeJumps = intervals.filter((interval) => Math.abs(interval) >= 7).length;
  const stepwise = intervals.filter((interval) => Math.abs(interval) <= 2).length;
  const total = intervals.length || 1;
  const stepwiseMotionRatio = stepwise / total;
  const contour = stepwiseMotionRatio >= 0.72 ? "smooth" : stepwiseMotionRatio >= 0.45 ? "balanced" : "angular";
  const motionType = stepwiseMotionRatio >= 0.72 ? "stepwise" : largeJumps / total >= 0.35 ? "leaping" : "mixed";
  return {
    ascendingIntervals,
    descendingIntervals,
    repeatedNotes,
    largeJumps,
    stepwiseMotionRatio: Number(stepwiseMotionRatio.toFixed(3)),
    averageInterval: Number(averageInterval(analysis.detectedNotes).toFixed(3)),
    largestLeap: largestLeap(analysis.detectedNotes),
    contour,
    motionType,
  };
}