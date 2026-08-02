import type { DetectedNote, PitchAnalysisResult } from "../pitch/types.js";
import type { InterpretationComplexity, MelodyStatistics, PerformanceStatistics, PhraseAnalysisResult } from "./types.js";
import { INTERPRETATION_COMPLEXITY_THRESHOLDS } from "./constants.js";

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function averageInterval(notes: DetectedNote[]) {
  if (notes.length < 2) return 0;
  const intervals = notes.slice(1).map((note, index) => Math.abs(note.midi - notes[index].midi));
  return average(intervals);
}

export function largestLeap(notes: DetectedNote[]) {
  if (notes.length < 2) return 0;
  return Math.max(...notes.slice(1).map((note, index) => Math.abs(note.midi - notes[index].midi)));
}

export function melodicStatistics(analysis: PitchAnalysisResult, phrases: PhraseAnalysisResult): MelodyStatistics {
  const notes = analysis.detectedNotes;
  const minMidi = notes.length ? Math.min(...notes.map((note) => note.midi)) : null;
  const maxMidi = notes.length ? Math.max(...notes.map((note) => note.midi)) : null;
  return {
    uniqueNotes: new Set(notes.map((note) => note.midi)).size,
    averageInterval: Number(averageInterval(notes).toFixed(3)),
    largestLeap: largestLeap(notes),
    averagePhraseLength: Number(average(phrases.phrases.map((phrase) => phrase.duration)).toFixed(3)),
    pitchRange: { minMidi, maxMidi, span: minMidi === null || maxMidi === null ? 0 : maxMidi - minMidi },
    averageDuration: Number(average(notes.map((note) => note.duration)).toFixed(3)),
  };
}

export function performanceStatistics(analysis: PitchAnalysisResult, phrases: PhraseAnalysisResult): PerformanceStatistics {
  return {
    restPercentage: Number(((analysis.silenceRegions.reduce((sum, region) => sum + region.duration, 0) / Math.max(analysis.recording.durationSeconds, 0.001)) * 100).toFixed(2)),
    rhythmicDensity: Number((analysis.detectedNotes.length / Math.max(analysis.recording.durationSeconds, 0.001)).toFixed(3)),
    noteCount: analysis.detectedNotes.length,
    phraseCount: phrases.phrases.length,
    averageVelocity: Number(average(analysis.detectedNotes.map((note) => note.velocity)).toFixed(2)),
    confidenceAverage: Number(average(analysis.detectedNotes.map((note) => note.confidence)).toFixed(3)),
  };
}

export function complexityScore(analysis: PitchAnalysisResult, phraseCount: number) {
  const noteDensity = analysis.detectedNotes.length / Math.max(analysis.recording.durationSeconds, 1);
  const interval = averageInterval(analysis.detectedNotes);
  const rhythmicSpread = median(analysis.timing.noteSpacing.length ? analysis.timing.noteSpacing : [analysis.statistics.averageNoteDuration || 0.25]);
  const repetitionPenalty = analysis.melody.repeatedNotes / Math.max(analysis.detectedNotes.length, 1);
  const raw = Math.max(0, Math.min(1,
    noteDensity * 0.08 +
    interval * 0.05 +
    phraseCount * 0.04 +
    (analysis.statistics.uniqueMidiCount / Math.max(analysis.detectedNotes.length, 1)) * 0.25 +
    (0.5 - Math.min(rhythmicSpread, 0.5)) * 0.2 +
    (1 - repetitionPenalty) * 0.1,
  ));
  const level: InterpretationComplexity = raw < INTERPRETATION_COMPLEXITY_THRESHOLDS.beginner
    ? "Beginner"
    : raw < INTERPRETATION_COMPLEXITY_THRESHOLDS.intermediate
      ? "Intermediate"
      : raw < INTERPRETATION_COMPLEXITY_THRESHOLDS.advanced
        ? "Advanced"
        : "Professional";
  return { score: Number(raw.toFixed(3)), level };
}