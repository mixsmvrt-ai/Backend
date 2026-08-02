export type SupportedGenre = string;

export type SupportedMood =
  | "Dark" | "Happy" | "Sad" | "Aggressive" | "Dreamy" | "Epic" | "Relaxed"
  | "Melancholy" | "Energetic" | "Calm" | "Emotional" | "Hopeful" | "Mysterious";

export type EnergyLevel = "Low" | "Medium" | "High";
export type ComplexityLevel = "Simple" | "Medium" | "Advanced" | "Expert";
export type HumanizationLevel = "Low" | "Medium" | "High";
export type GenerationType = "Melody" | "Chord Progression" | "Bassline" | "Counter Melody" | "Drums" | "Arpeggio" | "Full Composition" | "Variation" | "Continuation";
export type DifficultyLevel = "Beginner" | "Intermediate" | "Advanced";

export interface PluginRecommendation {
  instrumentType: string;
  presetType: string;
  genreMatch: string;
  moodMatch: string;
  alternative: string;
}

export interface GenreProfile {
  id: string;
  name: string;
  slug: string;
  description: string;
  tempoMin: number;
  tempoMax: number;
  defaultTempo: number;
  primaryScales: string[];
  secondaryScales: string[];
  commonTimeSignatures: string[];
  commonInstruments: string[];
  melodyDensity: string;
  rhythmComplexity: string;
  commonIntervals: string[];
  typicalNoteLengths: string[];
  swingAmount: number;
  bassStyle: string;
  chordComplexity: string;
  velocityRange: number[];
  humanizationAmount: number;
  energy: string;
  brightness: string;
  aggressiveness: string;
  groove: string;
  mood: string[];
  active: boolean;
}

export interface TempoAdvisory {
  requestedTempo: number;
  minTempo: number;
  maxTempo: number;
  message: string;
}

export interface MusicContext {
  prompt: string;
  enhancedPrompt: string;
  genre: SupportedGenre;
  genreProfile: GenreProfile | null;
  mood: SupportedMood;
  tempo: number;
  tempoAdvisory?: TempoAdvisory | null;
  key: string;
  scale: string;
  complexity: ComplexityLevel;
  energy: EnergyLevel;
  emotion: string;
  generationType: GenerationType;
  instrumentSuggestions: string[];
  songLength: string;
  humanization: HumanizationLevel;
  timeSignature: [number, number];
  recommendedPlugins: PluginRecommendation[];
  style?: string;
  originalityNotice?: string;
  difficulty: DifficultyLevel;
  daw?: string;
  pluginPreference?: string;
}

export interface MusicBrainInput {
  prompt: string;
  kind?: string;
  genre?: string;
  mood?: string;
  tempo?: number;
  key?: string;
  scale?: string;
  complexity?: string;
  lengthBars?: number;
  timeSignature?: [number, number];
  difficulty?: string;
  targetDaw?: string;
  style?: string;
  originalityNotice?: string;
}

export class MusicBrainValidationError extends Error {
  readonly code = "MUSIC_BRAIN_VALIDATION_ERROR";
  constructor(message: string) {
    super(message);
    this.name = "MusicBrainValidationError";
  }
}
