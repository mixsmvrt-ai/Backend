import { confidenceBand } from "./utils.js";
import type { DetectedNote, PitchConfidenceSummary, PitchFrameAnalysis } from "./types.js";

export function averageNoteConfidence(notes: DetectedNote[]) {
  if (notes.length === 0) return 0;
  const weighted = notes.reduce((sum, note) => sum + note.confidence * note.duration, 0);
  const duration = notes.reduce((sum, note) => sum + note.duration, 0);
  return duration > 0 ? weighted / duration : 0;
}

export function voicedFrameRatio(frames: PitchFrameAnalysis[]) {
  if (frames.length === 0) return 0;
  const voiced = frames.filter((frame) => frame.midi !== null && frame.confidence > 0.25).length;
  return voiced / frames.length;
}

export function overallConfidence(notes: DetectedNote[], frames: PitchFrameAnalysis[], threshold: number): PitchConfidenceSummary {
  const noteAverage = averageNoteConfidence(notes);
  const voicedRatio = voicedFrameRatio(frames);
  const polyphonyPenalty = frames.length === 0 ? 0 : frames.reduce((sum, frame) => sum + frame.secondaryPeakRatio, 0) / frames.length;
  const overall = Math.max(0, Math.min(1, noteAverage * 0.68 + voicedRatio * 0.22 + (1 - polyphonyPenalty) * 0.1));
  return {
    overall,
    band: confidenceBand(overall),
    noteAverage,
    voicedFrameRatio: voicedRatio,
    threshold,
  };
}