import type { PitchAnalysisResult } from "../pitch/types.js";

export function createPitchAnalysisFixture(): PitchAnalysisResult {
  return {
    recording: {
      provider: "aubio",
      audioUploadId: "audio-1",
      durationSeconds: 4.4,
      sampleRate: 16000,
      channels: 1,
    },
    detectedNotes: [
      note(60, 0, 0.4),
      note(62, 0.45, 0.35),
      note(64, 0.85, 0.35),
      note(67, 1.25, 0.45),
      note(60, 2.0, 0.4),
      note(62, 2.45, 0.35),
      note(64, 2.85, 0.35),
      note(67, 3.25, 0.5),
    ],
    detectedMidiNumbers: [60, 62, 64, 67, 60, 62, 64, 67],
    frequencies: [261.63, 293.66, 329.63, 392, 261.63, 293.66, 329.63, 392],
    timing: {
      onsetTimes: [0, 0.45, 0.85, 1.25, 2, 2.45, 2.85, 3.25],
      offsetTimes: [0.4, 0.8, 1.2, 1.7, 2.4, 2.8, 3.2, 3.75],
      noteSpacing: [0.45, 0.4, 0.4, 0.75, 0.45, 0.4, 0.4],
      phraseBoundaries: [0, 2],
    },
    tempo: {
      bpm: 102,
      confidence: 0.72,
      beatLocations: [0, 0.588, 1.176, 1.764, 2.352, 2.94, 3.528, 4.116],
      swingEstimate: 0.53,
    },
    estimatedKey: { key: "C", scale: "major", mode: "major", confidence: 0.8 },
    estimatedScale: { key: "C", scale: "major", mode: "major", confidence: 0.79 },
    confidence: { overall: 0.83, band: "high", noteAverage: 0.82, voicedFrameRatio: 0.74, threshold: 0.55 },
    pitchCurve: [],
    silenceRegions: [
      { startTime: 1.7, endTime: 2.0, duration: 0.3 },
    ],
    melody: {
      direction: "ascending",
      pitchContour: ["ascending", "ascending", "ascending", "descending", "ascending", "ascending", "ascending"],
      repeatingPhrases: [{ pattern: "0,2,4,7", occurrences: 2 }],
      intervals: [2, 2, 3, -7, 2, 2, 3],
      phraseBoundaries: [0, 2],
      repeatedNotes: 0,
      polyphonicLikelihood: 0.1,
    },
    statistics: {
      noteCount: 8,
      uniqueMidiCount: 4,
      averageNoteDuration: 0.394,
      pitchRange: { minMidi: 60, maxMidi: 67 },
      voicedFrameRatio: 0.74,
      averageConfidence: 0.82,
      repeatedNoteRatio: 0,
      polyphonicLikelihood: 0.1,
    },
  };
}

function note(midi: number, startTime: number, duration: number) {
  return {
    midi,
    noteName: ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][midi % 12],
    scientificName: `${["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][midi % 12]}${Math.floor(midi / 12) - 1}`,
    frequency: 440 * 2 ** ((midi - 69) / 12),
    velocity: 90,
    confidence: 0.82,
    confidenceBand: "high" as const,
    startTime,
    endTime: startTime + duration,
    duration,
    pitchCurve: [],
  };
}