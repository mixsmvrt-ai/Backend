import type { PitchAnalysisResult } from "../pitch/types.js";
import { DEFAULT_PROGRESSIONS, HARMONIC_FUNCTIONS, MODE_PITCH_CLASSES, TONIC_NAMES } from "./constants.js";
import type { ChordSuggestion, HarmonyAnalysisResult, ScaleProfile } from "./types.js";

function tonicPitchClass(key: string | null) {
  if (!key) return null;
  const index = TONIC_NAMES.indexOf(key);
  return index >= 0 ? index : null;
}

function profileFor(analysis: PitchAnalysisResult): ScaleProfile {
  const mode = analysis.estimatedScale.scale ?? analysis.estimatedKey.mode ?? "major";
  return {
    tonicPitchClass: tonicPitchClass(analysis.estimatedKey.key),
    pitchClasses: MODE_PITCH_CLASSES[mode] ?? MODE_PITCH_CLASSES.major,
  };
}

function degreeChord(tonic: number | null, degree: string) {
  if (tonic === null) return { chordName: degree, inversion: null };
  const roman = degree.replace("b", "");
  const degreeMap: Record<string, number> = { I: 0, ii: 2, iii: 4, IV: 5, V: 7, vi: 9, vii: 11, i: 0, III: 3, VI: 8, VII: 10 };
  const accidental = degree.startsWith("b") ? -1 : 0;
  const pitchClass = (tonic + (degreeMap[roman] ?? 0) + accidental + 12) % 12;
  const note = TONIC_NAMES[pitchClass];
  const quality = degree === degree.toLowerCase() ? "m" : "";
  return { chordName: `${note}${quality}`, inversion: degree === "V" ? "1st inversion optional" : null };
}

export function analyzeHarmony(analysis: PitchAnalysisResult): HarmonyAnalysisResult {
  const profile = profileFor(analysis);
  const mode = analysis.estimatedScale.scale ?? analysis.estimatedKey.mode ?? "major";
  const progression = DEFAULT_PROGRESSIONS[mode] ?? DEFAULT_PROGRESSIONS.major;
  const chordProgression: ChordSuggestion[] = progression.map((romanNumeral, index) => {
    const chord = degreeChord(profile.tonicPitchClass, romanNumeral);
    return {
      romanNumeral,
      chordName: chord.chordName,
      function: HARMONIC_FUNCTIONS[romanNumeral] ?? "color",
      confidence: Number((0.58 + Math.max(0, 0.18 - index * 0.02)).toFixed(3)),
      inversion: chord.inversion,
      passingChord: index < progression.length - 1 ? "Add ii or iv passing color" : null,
      alternatives: romanNumeral === "V" ? ["ii-V", "sus4 dominant"] : romanNumeral === "i" || romanNumeral === "I" ? ["add6 color", "maj7/min9 pad"] : ["secondary dominant", "add9 voicing"],
    };
  });

  return {
    chordProgression,
    alternativeProgressions: mode.includes("minor")
      ? ["i-VI-III-VII", "i-iv-VII-III", "i-VII-VI-V"]
      : ["I-V-vi-IV", "I-IV-ii-V", "vi-IV-I-V"],
    tonalCenter: analysis.estimatedKey.key,
  };
}