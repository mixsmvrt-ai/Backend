import type { PitchAnalysisResult } from "../pitch/types.js";
import { GENRES } from "./constants.js";
import type { GenreScore } from "./types.js";

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function analyzeGenres(analysis: PitchAnalysisResult): GenreScore[] {
  const tempo = analysis.tempo.bpm ?? 100;
  const minor = (analysis.estimatedScale.scale ?? "major").includes("minor");
  const swing = analysis.tempo.swingEstimate ?? 0;
  const density = analysis.detectedNotes.length / Math.max(analysis.recording.durationSeconds, 1);
  const syncopation = analysis.timing.noteSpacing.length > 0 ? analysis.timing.noteSpacing.filter((spacing) => spacing < 0.22).length / analysis.timing.noteSpacing.length : 0;
  const cinematicRange = analysis.statistics.pitchRange.maxMidi !== null && analysis.statistics.pitchRange.minMidi !== null
    ? analysis.statistics.pitchRange.maxMidi - analysis.statistics.pitchRange.minMidi
    : 0;

  const scores: Record<string, GenreScore> = {
    Trap: { genre: "Trap", confidence: clamp((tempo >= 130 && tempo <= 170 ? 0.42 : 0.16) + (minor ? 0.18 : 0.04) + syncopation * 0.25), reasons: ["high-energy pocket", minor ? "minor tonal center" : ""] },
    Drill: { genre: "Drill", confidence: clamp((tempo >= 138 && tempo <= 155 ? 0.42 : 0.14) + (minor ? 0.2 : 0.03) + density * 0.05), reasons: ["driving pace", minor ? "dark tonality" : ""] },
    Dancehall: { genre: "Dancehall", confidence: clamp((tempo >= 92 && tempo <= 110 ? 0.35 : 0.12) + swing * 0.3 + syncopation * 0.15), reasons: ["bounce rhythm", swing > 0.54 ? "swing feel" : ""] },
    Afrobeats: { genre: "Afrobeats", confidence: clamp((tempo >= 96 && tempo <= 118 ? 0.34 : 0.12) + swing * 0.25 + (analysis.statistics.uniqueMidiCount >= 5 ? 0.1 : 0.02)), reasons: ["mid-tempo groove", "melodic repetition"] },
    House: { genre: "House", confidence: clamp((tempo >= 118 && tempo <= 130 ? 0.38 : 0.12) + (syncopation < 0.32 ? 0.14 : 0.04) + density * 0.04), reasons: ["steady pulse", "club tempo"] },
    LoFi: { genre: "LoFi", confidence: clamp((tempo >= 68 && tempo <= 92 ? 0.38 : 0.1) + ((analysis.estimatedScale.scale ?? "").includes("minor") ? 0.12 : 0.06) + (analysis.statistics.averageNoteDuration > 0.28 ? 0.12 : 0.04)), reasons: ["laid-back tempo", "gentle phrasing"] },
    EDM: { genre: "EDM", confidence: clamp((tempo >= 120 && tempo <= 150 ? 0.4 : 0.14) + density * 0.05 + (cinematicRange >= 12 ? 0.1 : 0.03)), reasons: ["festival-ready tempo", "energetic contour"] },
    "Hip Hop": { genre: "Hip Hop", confidence: clamp((tempo >= 78 && tempo <= 104 ? 0.34 : 0.14) + syncopation * 0.2 + (minor ? 0.08 : 0.04)), reasons: ["head-nod pocket", "repetitive motif use"] },
    Pop: { genre: "Pop", confidence: clamp((tempo >= 96 && tempo <= 124 ? 0.34 : 0.12) + (analysis.statistics.repeatedNoteRatio >= 0.2 ? 0.14 : 0.03) + (analysis.statistics.uniqueMidiCount >= 4 ? 0.08 : 0.03)), reasons: ["memorable hook tendency", "accessible range"] },
    Jazz: { genre: "Jazz", confidence: clamp((swing >= 0.57 ? 0.24 : 0.04) + (analysis.statistics.uniqueMidiCount >= 7 ? 0.16 : 0.04) + (analysis.statistics.averageNoteDuration < 0.24 ? 0.1 : 0.03)), reasons: ["phrase complexity", swing >= 0.57 ? "swing articulation" : ""] },
    Cinematic: { genre: "Cinematic", confidence: clamp((cinematicRange >= 14 ? 0.28 : 0.08) + (analysis.statistics.averageNoteDuration > 0.35 ? 0.14 : 0.05) + (minor ? 0.1 : 0.08)), reasons: ["wide dramatic range", "phrase-driven pacing"] },
  };

  return GENRES.map((genre) => scores[genre]).sort((left, right) => right.confidence - left.confidence);
}