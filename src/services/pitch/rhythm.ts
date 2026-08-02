import { average, median, round } from "./utils.js";
import type { DetectedNote, TempoEstimate, TimingAnalysis } from "./types.js";
import { phraseBoundaries } from "./timing.js";

function normalizeBeatInterval(interval: number) {
  let value = interval;
  while (value > 1) value /= 2;
  while (value < 0.33) value *= 2;
  return value;
}

function estimateBpm(noteSpacing: number[]) {
  const candidates = noteSpacing.filter((value) => value > 0.05 && value < 2).map(normalizeBeatInterval);
  if (candidates.length === 0) return { bpm: null, confidence: 0, beatPeriod: null as number | null };
  const beatPeriod = median(candidates);
  const bpm = 60 / beatPeriod;
  const deviation = average(candidates.map((value) => Math.abs(value - beatPeriod)));
  const confidence = Math.max(0, Math.min(1, 1 - deviation / Math.max(beatPeriod, 0.001)));
  return { bpm: round(bpm, 2), confidence: round(confidence), beatPeriod };
}

function estimateSwing(noteSpacing: number[]) {
  if (noteSpacing.length < 4) return null;
  const ratios: number[] = [];
  for (let index = 0; index + 1 < noteSpacing.length; index += 2) {
    const first = noteSpacing[index];
    const second = noteSpacing[index + 1];
    const sum = first + second;
    if (sum > 0.08) ratios.push(first / sum);
  }
  return ratios.length > 0 ? round(median(ratios), 3) : null;
}

export function analyzeRhythm(notes: DetectedNote[], durationSeconds: number): { tempo: TempoEstimate; timing: TimingAnalysis } {
  const onsetTimes = notes.map((note) => round(note.startTime));
  const offsetTimes = notes.map((note) => round(note.endTime));
  const noteSpacing = onsetTimes.slice(1).map((time, index) => round(time - onsetTimes[index]));
  const bpmEstimate = estimateBpm(noteSpacing);
  const beatPeriod = bpmEstimate.beatPeriod;
  const beatLocations = beatPeriod === null
    ? []
    : Array.from({ length: Math.max(1, Math.floor(durationSeconds / beatPeriod) + 1) }, (_value, index) => round(index * beatPeriod));

  return {
    tempo: {
      bpm: bpmEstimate.bpm,
      confidence: bpmEstimate.confidence,
      beatLocations,
      swingEstimate: estimateSwing(noteSpacing),
    },
    timing: {
      onsetTimes,
      offsetTimes,
      noteSpacing,
      phraseBoundaries: phraseBoundaries(notes, bpmEstimate.beatPeriod),
    },
  };
}