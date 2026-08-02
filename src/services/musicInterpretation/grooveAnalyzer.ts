import type { PitchAnalysisResult } from "../pitch/types.js";
import type { GrooveResult } from "./types.js";

export function analyzeGroove(analysis: PitchAnalysisResult): GrooveResult {
  const swing = analysis.tempo.swingEstimate ?? 0;
  const beatLocations = analysis.tempo.beatLocations;
  const beatPeriod = beatLocations.length >= 2 ? beatLocations[1] - beatLocations[0] : null;
  const offBeatRatio = beatPeriod === null
    ? 0
    : analysis.timing.onsetTimes.filter((onset) => {
      const normalized = (onset / beatPeriod) % 1;
      return normalized > 0.2 && normalized < 0.8;
    }).length / Math.max(analysis.timing.onsetTimes.length, 1);

  const primary = swing >= 0.58
    ? "Swing"
    : offBeatRatio >= 0.45
      ? "Syncopated"
      : (analysis.tempo.bpm ?? 0) >= 120
        ? "Driving"
        : (analysis.statistics.averageNoteDuration > 0.35 ? "Laid Back" : "Straight");
    const traits: GrooveResult["traits"] = [primary];
  if (offBeatRatio >= 0.3 && !traits.includes("Bounce")) traits.push("Bounce");
  if (primary !== "Driving" && (analysis.tempo.bpm ?? 0) >= 118) traits.push("Driving");
  return {
    primary,
    confidence: Number((0.55 + Math.min(0.35, Math.abs(offBeatRatio - 0.25))).toFixed(3)),
    traits,
  };
}