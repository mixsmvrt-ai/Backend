import type { DetectedNote, PitchAnalysisResult } from "../pitch/types.js";

export type InterpretationGenre = "Trap" | "Drill" | "Dancehall" | "Afrobeats" | "House" | "LoFi" | "EDM" | "Hip Hop" | "Pop" | "Jazz" | "Cinematic";
export type InterpretationEmotion = "Dark" | "Happy" | "Sad" | "Aggressive" | "Hopeful" | "Epic" | "Dreamy" | "Melancholy" | "Relaxed";
export type InterpretationEnergy = "Very Low" | "Low" | "Medium" | "High" | "Extreme";
export type InterpretationComplexity = "Beginner" | "Intermediate" | "Advanced" | "Professional";
export type InterpretationGroove = "Swing" | "Bounce" | "Straight" | "Syncopated" | "Laid Back" | "Driving";
export type PhraseRole = "opening" | "answer" | "question" | "ending" | "development";
export type MotionType = "stepwise" | "mixed" | "leaping";

export interface MusicalPhrase {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  noteCount: number;
  contour: "ascending" | "descending" | "arch" | "flat" | "mixed";
  role: PhraseRole;
  cadence: "resolved" | "open" | "neutral";
  averageInterval: number;
  repeatedIdea: boolean;
}

export interface PhraseAnalysisResult {
  phrases: MusicalPhrase[];
  phraseBoundaries: number[];
  repeatedIdeas: string[];
  questionAnswerPairs: Array<{ questionPhraseId: string; answerPhraseId: string; confidence: number }>;
  openingPhraseId: string | null;
  endingPhraseId: string | null;
}

export interface MotifMatch {
  id: string;
  pattern: string;
  noteIndexes: number[];
  occurrences: number;
  variationType: "exact" | "transposed" | "rhythmic" | "inverted";
  confidence: number;
}

export interface MotifAnalysisResult {
  motifs: MotifMatch[];
  sequences: string[];
  transformations: string[];
}

export interface IntervalAnalysisResult {
  ascendingIntervals: number[];
  descendingIntervals: number[];
  repeatedNotes: number;
  largeJumps: number;
  stepwiseMotionRatio: number;
  averageInterval: number;
  largestLeap: number;
  contour: "smooth" | "balanced" | "angular";
  motionType: MotionType;
}

export interface RhythmAnalysisResult {
  rhythmicDensity: number;
  averageDuration: number;
  restPercentage: number;
  syncopation: number;
  beatAlignment: number;
  swing: number;
}

export interface MelodyDescriptor {
  isHook: boolean;
  isLeadMelody: boolean;
  shape: "simple" | "complex";
  motion: "smooth" | "angular" | "balanced";
  repetition: "low" | "moderate" | "high";
}

export interface MelodyAnalysisResult {
  descriptor: MelodyDescriptor;
  leadScore: number;
  hookScore: number;
  register: "low" | "mid" | "high" | "wide";
}

export interface ChordSuggestion {
  romanNumeral: string;
  chordName: string;
  function: string;
  confidence: number;
  inversion: string | null;
  passingChord: string | null;
  alternatives: string[];
}

export interface HarmonyAnalysisResult {
  chordProgression: ChordSuggestion[];
  alternativeProgressions: string[];
  tonalCenter: string | null;
}

export interface BasslineSuggestion {
  rootMotion: string[];
  octavePlacement: string;
  groove: string;
  patternIdeas: string[];
}

export interface CounterMelodySuggestion {
  direction: "parallel" | "contrary" | "oblique";
  register: string;
  rhythm: string;
  complexity: InterpretationComplexity;
}

export interface GenreScore {
  genre: InterpretationGenre;
  confidence: number;
  reasons: string[];
}

export interface EmotionResult {
  primary: InterpretationEmotion;
  secondary: InterpretationEmotion | null;
  confidence: number;
  palette: InterpretationEmotion[];
}

export interface EnergyResult {
  level: InterpretationEnergy;
  score: number;
  confidence: number;
}

export interface GrooveResult {
  primary: InterpretationGroove;
  confidence: number;
  traits: InterpretationGroove[];
}

export interface ScaleAnalysisResult {
  currentScale: string | null;
  confidence: number;
  alternatives: string[];
}

export interface KeyAnalysisResult {
  currentKey: string | null;
  confidence: number;
  alternatives: string[];
}

export interface VariationSuggestion {
  category: "rhythmic" | "melodic" | "harmonic" | "arrangement";
  suggestion: string;
  reason: string;
}

export interface MelodyStatistics {
  uniqueNotes: number;
  averageInterval: number;
  largestLeap: number;
  averagePhraseLength: number;
  pitchRange: { minMidi: number | null; maxMidi: number | null; span: number };
  averageDuration: number;
}

export interface PerformanceStatistics {
  restPercentage: number;
  rhythmicDensity: number;
  noteCount: number;
  phraseCount: number;
  averageVelocity: number;
  confidenceAverage: number;
}

export interface RecommendationSet {
  betterKey: string | null;
  alternativeTempo: number | null;
  alternativeScale: string | null;
  chordOptions: string[];
  instrumentCategories: string[];
  productionIdeas: string[];
  arrangementIdeas: string[];
  counterMelody: CounterMelodySuggestion;
  bassline: BasslineSuggestion;
}

export interface MusicBrainHints {
  genre: string | null;
  mood: string | null;
  tempo: number | null;
  key: string | null;
  scale: string | null;
  complexity: InterpretationComplexity;
  style: string;
}

export interface MusicalSummary {
  concise: string;
  phrases: string;
  groove: string;
  harmony: string;
  production: string;
}

export interface MusicInterpretationResult {
  source: {
    pitchAnalysisId: string | null;
    projectId: string | null;
    audioUploadId: string | null;
    provider: string | null;
  };
  musicalSummary: MusicalSummary;
  genreConfidence: GenreScore[];
  emotion: EmotionResult;
  energy: EnergyResult;
  complexity: { level: InterpretationComplexity; score: number; confidence: number; reasons: string[] };
  phraseAnalysis: PhraseAnalysisResult;
  motifAnalysis: MotifAnalysisResult;
  intervalAnalysis: IntervalAnalysisResult;
  rhythmAnalysis: RhythmAnalysisResult;
  melodyAnalysis: MelodyAnalysisResult;
  harmony: HarmonyAnalysisResult;
  groove: GrooveResult;
  scaleAnalysis: ScaleAnalysisResult;
  keyAnalysis: KeyAnalysisResult;
  variationAnalysis: VariationSuggestion[];
  melodyStatistics: MelodyStatistics;
  performanceStatistics: PerformanceStatistics;
  recommendations: RecommendationSet;
  scaleConfidence: number;
  overallConfidence: number;
  musicBrainHints: MusicBrainHints;
}

export interface MusicInterpretationRecord {
  id: string;
  userId: string;
  projectId: string | null;
  pitchAnalysisId: string | null;
  confidence: number;
  interpretation: MusicInterpretationResult;
  recommendations: RecommendationSet;
  createdAt: string;
}

export interface InterpretationSourceRecord {
  id: string;
  userId: string;
  projectId: string | null;
  analysis: PitchAnalysisResult;
  estimatedBpm: number | null;
  estimatedKey: string | null;
  estimatedScale: string | null;
  overallConfidence: number;
  provider: string;
  audioUploadId: string;
}

export interface MusicInterpretationRequest {
  pitchAnalysisId?: string;
  projectId?: string | null;
  analysis?: PitchAnalysisResult;
}

export interface InterpretationContext {
  projectId: string | null;
  pitchAnalysisId: string | null;
  audioUploadId: string | null;
  provider: string | null;
}

export interface InterpretationInput {
  analysis: PitchAnalysisResult;
  context: InterpretationContext;
}

export interface InterpretationRepository {
  getPitchAnalysis(userId: string, pitchAnalysisId: string): Promise<InterpretationSourceRecord>;
  createInterpretation(userId: string, source: InterpretationContext, interpretation: MusicInterpretationResult): Promise<MusicInterpretationRecord>;
  getInterpretation(userId: string, interpretationId: string): Promise<MusicInterpretationRecord>;
  deleteInterpretation(userId: string, interpretationId: string): Promise<void>;
}

export interface ScaleProfile {
  tonicPitchClass: number | null;
  pitchClasses: number[];
}

export interface MusicalFeatureSnapshot {
  notes: DetectedNote[];
  durationSeconds: number;
  medianDuration: number;
  averageVelocity: number;
  averageConfidence: number;
}

export class MusicInterpretationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "MusicInterpretationError";
  }
}