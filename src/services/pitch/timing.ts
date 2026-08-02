import { round } from "./utils.js";
import type { DetectedNote, PitchCurvePoint, SilenceRegion } from "./types.js";

export function detectSilenceRegions(curve: PitchCurvePoint[], threshold: number) {
  const regions: SilenceRegion[] = [];
  let start: number | null = null;
  let previousTime = 0;

  for (const point of curve) {
    const silent = point.frequency === null || point.amplitude < threshold;
    if (silent && start === null) {
      start = point.time;
    }
    if (!silent && start !== null) {
      regions.push({ startTime: round(start), endTime: round(previousTime), duration: round(previousTime - start) });
      start = null;
    }
    previousTime = point.time;
  }

  if (start !== null) {
    regions.push({ startTime: round(start), endTime: round(previousTime), duration: round(previousTime - start) });
  }

  return regions.filter((region) => region.duration > 0.05);
}

export function phraseBoundaries(notes: DetectedNote[], beatPeriodSeconds: number | null) {
  if (notes.length === 0) return [];
  const gapThreshold = beatPeriodSeconds ? Math.max(0.35, beatPeriodSeconds * 0.75) : 0.4;
  const boundaries: number[] = [round(notes[0].startTime)];
  for (let index = 1; index < notes.length; index += 1) {
    if (notes[index].startTime - notes[index - 1].endTime >= gapThreshold) {
      boundaries.push(round(notes[index].startTime));
    }
  }
  return boundaries;
}