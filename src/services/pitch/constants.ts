import type { PitchProviderName, PitchProviderTuning } from "./types.js";

export const MIN_SUPPORTED_MIDI = 24;
export const MAX_SUPPORTED_MIDI = 108;
export const MIN_SUPPORTED_FREQUENCY = 32.7031956626;
export const MAX_SUPPORTED_FREQUENCY = 4186.00904481;
export const DEFAULT_PITCH_TIMEOUT_MS = 45_000;
export const DEFAULT_PITCH_CONFIDENCE_THRESHOLD = 0.55;
export const DEFAULT_PITCH_TEMP_DIR_NAME = "midiflow-pitch";
export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
export const DEFAULT_PROVIDER: PitchProviderName = "aubio";

export const PROVIDER_TUNINGS: Record<PitchProviderName, PitchProviderTuning> = {
  aubio: {
    frameSize: 1024,
    hopSize: 128,
    smoothingFrames: 3,
    minCorrelation: 0.6,
    silenceThreshold: 0.015,
    minNoteDurationSeconds: 0.07,
    noteMergeSemitones: 1,
    onsetGapSeconds: 0.1,
  },
  crepe: {
    frameSize: 2048,
    hopSize: 96,
    smoothingFrames: 5,
    minCorrelation: 0.57,
    silenceThreshold: 0.012,
    minNoteDurationSeconds: 0.06,
    noteMergeSemitones: 1,
    onsetGapSeconds: 0.09,
  },
  essentia: {
    frameSize: 2048,
    hopSize: 256,
    smoothingFrames: 7,
    minCorrelation: 0.63,
    silenceThreshold: 0.018,
    minNoteDurationSeconds: 0.08,
    noteMergeSemitones: 1,
    onsetGapSeconds: 0.12,
  },
};

export const SCALE_PROFILES: Record<string, number[]> = {
  major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
  minor: [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17],
  dorian: [5.2, 2.5, 3.6, 2.8, 4.1, 3.8, 2.7, 4.6, 2.4, 3.9, 2.6, 3.1],
  mixolydian: [5.9, 2.4, 3.2, 2.3, 4.2, 4.0, 2.2, 5.1, 2.6, 3.3, 2.0, 3.2],
  major_pentatonic: [5.5, 0.8, 3.4, 0.7, 4.2, 4.0, 0.9, 4.8, 0.8, 3.5, 0.7, 0.9],
  minor_pentatonic: [4.8, 0.9, 3.2, 4.2, 0.8, 3.6, 0.9, 4.5, 3.8, 0.9, 3.1, 0.8],
};