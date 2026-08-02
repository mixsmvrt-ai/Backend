export type PitchProviderName = "aubio" | "crepe" | "essentia";

export type ConfidenceBand = "low" | "medium" | "high";

export interface PitchProviderTuning {
  frameSize: number;
  hopSize: number;
  smoothingFrames: number;
  minCorrelation: number;
  silenceThreshold: number;
  minNoteDurationSeconds: number;
  noteMergeSemitones: number;
  onsetGapSeconds: number;
}

export interface PitchAnalysisRequest {
  audioId: string;
  provider?: PitchProviderName;
}

export interface PitchCurvePoint {
  time: number;
  frequency: number | null;
  midi: number | null;
  noteName: string | null;
  confidence: number;
  amplitude: number;
}

export interface SilenceRegion {
  startTime: number;
  endTime: number;
  duration: number;
}

export interface DetectedNote {
  midi: number;
  noteName: string;
  scientificName: string;
  frequency: number;
  velocity: number;
  confidence: number;
  confidenceBand: ConfidenceBand;
  startTime: number;
  endTime: number;
  duration: number;
  pitchCurve: PitchCurvePoint[];
}

export interface KeyEstimate {
  key: string | null;
  scale: string | null;
  mode: string | null;
  confidence: number;
}

export interface TempoEstimate {
  bpm: number | null;
  confidence: number;
  beatLocations: number[];
  swingEstimate: number | null;
}

export interface TimingAnalysis {
  onsetTimes: number[];
  offsetTimes: number[];
  noteSpacing: number[];
  phraseBoundaries: number[];
}

export interface MelodyPattern {
  pattern: string;
  occurrences: number;
}

export interface MelodyAnalysis {
  direction: "ascending" | "descending" | "repeated" | "mixed";
  pitchContour: Array<"ascending" | "descending" | "repeated">;
  repeatingPhrases: MelodyPattern[];
  intervals: number[];
  phraseBoundaries: number[];
  repeatedNotes: number;
  polyphonicLikelihood: number;
}

export interface PitchAnalysisStatistics {
  noteCount: number;
  uniqueMidiCount: number;
  averageNoteDuration: number;
  pitchRange: { minMidi: number | null; maxMidi: number | null };
  voicedFrameRatio: number;
  averageConfidence: number;
  repeatedNoteRatio: number;
  polyphonicLikelihood: number;
}

export interface PitchConfidenceSummary {
  overall: number;
  band: ConfidenceBand;
  noteAverage: number;
  voicedFrameRatio: number;
  threshold: number;
}

export interface PitchRecordingSummary {
  provider: PitchProviderName;
  audioUploadId: string;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
}

export interface PitchAnalysisResult {
  recording: PitchRecordingSummary;
  detectedNotes: DetectedNote[];
  detectedMidiNumbers: number[];
  frequencies: number[];
  timing: TimingAnalysis;
  tempo: TempoEstimate;
  estimatedKey: KeyEstimate;
  estimatedScale: KeyEstimate;
  confidence: PitchConfidenceSummary;
  pitchCurve: PitchCurvePoint[];
  silenceRegions: SilenceRegion[];
  melody: MelodyAnalysis;
  statistics: PitchAnalysisStatistics;
}

export interface PitchAnalysisRecord {
  id: string;
  userId: string;
  projectId: string | null;
  audioUploadId: string;
  provider: PitchProviderName;
  estimatedBpm: number | null;
  estimatedKey: string | null;
  estimatedScale: string | null;
  overallConfidence: number;
  analysis: PitchAnalysisResult;
  createdAt: string;
}

export interface PitchAudioSource {
  id: string;
  userId: string;
  projectId: string | null;
  status: string;
  duration: number | null;
  sampleRate: number | null;
  channels: number | null;
  processedFile: {
    bucket: string;
    path: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  } | null;
}

export interface PitchWavData {
  sampleRate: number;
  channels: number;
  durationSeconds: number;
  samples: Float32Array;
}

export interface PitchFrameAnalysis {
  time: number;
  endTime: number;
  frequency: number | null;
  midiFloat: number | null;
  midi: number | null;
  confidence: number;
  amplitude: number;
  noteName: string | null;
  secondaryPeakRatio: number;
}

export class PitchAnalysisError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "PitchAnalysisError";
  }
}