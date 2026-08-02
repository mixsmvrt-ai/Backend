import { SCALE_PROFILES } from "./constants.js";
import { cosineSimilarity, normalizeHistogram, rotate, round } from "./utils.js";
import type { DetectedNote, KeyEstimate, MelodyAnalysis } from "./types.js";
import { intervalSeries } from "./notes.js";

function pitchClassHistogram(notes: DetectedNote[]) {
  const histogram = new Array(12).fill(0);
  for (const note of notes) {
    histogram[note.midi % 12] += note.duration * Math.max(note.confidence, 0.05);
  }
  return normalizeHistogram(histogram);
}

export function estimateKey(notes: DetectedNote[]): KeyEstimate {
  if (notes.length === 0) {
    return { key: null, scale: null, mode: null, confidence: 0 };
  }

  const histogram = pitchClassHistogram(notes);
  let best = { tonic: 0, scale: "major", score: -Infinity };
  let second = { tonic: 0, scale: "major", score: -Infinity };

  for (const [scale, profile] of Object.entries(SCALE_PROFILES)) {
    for (let tonic = 0; tonic < 12; tonic += 1) {
      const score = cosineSimilarity(histogram, rotate(profile, tonic));
      if (score > best.score) {
        second = best;
        best = { tonic, scale, score };
      } else if (score > second.score) {
        second = { tonic, scale, score };
      }
    }
  }

  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const confidence = Math.max(0, Math.min(1, (best.score - second.score + 1) / 2));
  const mode = best.scale.includes("minor") ? "minor" : best.scale.includes("major") ? "major" : best.scale;
  return {
    key: noteNames[best.tonic],
    scale: best.scale,
    mode,
    confidence: round(confidence),
  };
}

function repeatingPhrases(notes: DetectedNote[]) {
  const sequence = notes.map((note) => note.midi);
  const patterns = new Map<string, number>();
  for (let length = 3; length <= 4; length += 1) {
    for (let start = 0; start + length <= sequence.length; start += 1) {
      const slice = sequence.slice(start, start + length).join("-");
      patterns.set(slice, (patterns.get(slice) ?? 0) + 1);
    }
  }
  return [...patterns.entries()]
    .filter((entry) => entry[1] > 1)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([pattern, occurrences]) => ({ pattern, occurrences }));
}

export function analyzeMelody(notes: DetectedNote[], polyphonicLikelihood: number, boundaries: number[]): MelodyAnalysis {
  const intervals = intervalSeries(notes);
  const contour = intervals.map((interval) => interval > 0 ? "ascending" : interval < 0 ? "descending" : "repeated" as const);
  const ascending = contour.filter((entry) => entry === "ascending").length;
  const descending = contour.filter((entry) => entry === "descending").length;
  const repeated = contour.filter((entry) => entry === "repeated").length;
  const direction = ascending > descending && ascending > repeated
    ? "ascending"
    : descending > ascending && descending > repeated
      ? "descending"
      : repeated > ascending && repeated > descending
        ? "repeated"
        : "mixed";

  return {
    direction,
    pitchContour: contour,
    repeatingPhrases: repeatingPhrases(notes),
    intervals,
    phraseBoundaries: boundaries,
    repeatedNotes: repeated,
    polyphonicLikelihood: round(polyphonicLikelihood),
  };
}