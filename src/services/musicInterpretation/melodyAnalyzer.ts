import type { PitchAnalysisResult } from "../pitch/types.js";
import type { IntervalAnalysisResult, MelodyAnalysisResult, MotifAnalysisResult } from "./types.js";

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function analyzeMelody(analysis: PitchAnalysisResult, intervals: IntervalAnalysisResult, motifs: MotifAnalysisResult): MelodyAnalysisResult {
  const range = analysis.statistics.pitchRange.maxMidi !== null && analysis.statistics.pitchRange.minMidi !== null
    ? analysis.statistics.pitchRange.maxMidi - analysis.statistics.pitchRange.minMidi
    : 0;
  const leadScore = Math.max(0, Math.min(1,
    range * 0.05 + analysis.statistics.uniqueMidiCount * 0.04 + analysis.confidence.noteAverage * 0.25 + (1 - analysis.statistics.repeatedNoteRatio) * 0.2,
  ));
  const hookScore = Math.max(0, Math.min(1,
    motifs.motifs.slice(0, 3).reduce((sum, motif) => sum + motif.occurrences * 0.08, 0) + analysis.statistics.repeatedNoteRatio * 0.3 + (analysis.tempo.bpm ? 0.12 : 0),
  ));
  const averageMidi = average(analysis.detectedNotes.map((note) => note.midi));
  const register = range >= 18 ? "wide" : averageMidi < 48 ? "low" : averageMidi > 72 ? "high" : "mid";
  return {
    descriptor: {
      isHook: hookScore >= 0.5,
      isLeadMelody: leadScore >= 0.48,
      shape: intervals.averageInterval >= 3.5 || analysis.detectedNotes.length >= 14 ? "complex" : "simple",
      motion: intervals.contour === "smooth" ? "smooth" : intervals.contour === "angular" ? "angular" : "balanced",
      repetition: analysis.statistics.repeatedNoteRatio >= 0.45 ? "high" : analysis.statistics.repeatedNoteRatio >= 0.2 ? "moderate" : "low",
    },
    leadScore: Number(leadScore.toFixed(3)),
    hookScore: Number(hookScore.toFixed(3)),
    register,
  };
}