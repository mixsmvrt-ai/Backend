import type { InterpretationEmotion, InterpretationGenre, InterpretationGroove } from "./types.js";

export const GENRES: InterpretationGenre[] = ["Trap", "Drill", "Dancehall", "Afrobeats", "House", "LoFi", "EDM", "Hip Hop", "Pop", "Jazz", "Cinematic"];
export const EMOTIONS: InterpretationEmotion[] = ["Dark", "Happy", "Sad", "Aggressive", "Hopeful", "Epic", "Dreamy", "Melancholy", "Relaxed"];
export const GROOVES: InterpretationGroove[] = ["Swing", "Bounce", "Straight", "Syncopated", "Laid Back", "Driving"];

export const MODE_PITCH_CLASSES: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  major_pentatonic: [0, 2, 4, 7, 9],
  minor_pentatonic: [0, 3, 5, 7, 10],
};

export const TONIC_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const HARMONIC_FUNCTIONS: Record<string, string> = {
  I: "tonic",
  ii: "predominant",
  iii: "mediant color",
  IV: "subdominant",
  V: "dominant",
  vi: "relative color",
  vii: "leading tension",
  i: "tonic",
  III: "relative color",
  VI: "predominant color",
  VII: "modal lift",
};

export const DEFAULT_PROGRESSIONS: Record<string, string[]> = {
  major: ["I", "vi", "IV", "V"],
  minor: ["i", "VI", "III", "VII"],
  dorian: ["i", "IV", "VII", "i"],
  mixolydian: ["I", "bVII", "IV", "I"],
  major_pentatonic: ["I", "IV", "V", "vi"],
  minor_pentatonic: ["i", "VII", "VI", "VII"],
};

export const INTERPRETATION_COMPLEXITY_THRESHOLDS = {
  beginner: 0.25,
  intermediate: 0.5,
  advanced: 0.75,
};