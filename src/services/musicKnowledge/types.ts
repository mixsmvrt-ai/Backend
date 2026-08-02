export type EnergyLevel = "Very Low" | "Low" | "Medium" | "High" | "Extreme";
export type ScaleDifficulty = "Beginner" | "Intermediate" | "Advanced" | "Expert";
export type TonalityPreference = "Major" | "Minor" | "Modal" | "Mixed";
export type KeyTonality = "Major" | "Minor" | "Mode";
export type SearchIntent = "genre" | "tempo" | "key" | "scale" | "chord" | "instrument" | "plugin" | "general";

export interface TempoRange {
  genre: string;
  minBpm: number;
  maxBpm: number;
  defaultBpm: number;
}

export interface ScaleKnowledge {
  name: string;
  intervals: number[];
  moodTags: string[];
  genres: string[];
  difficulty: ScaleDifficulty;
}

export interface KeyKnowledge {
  name: string;
  tonality: KeyTonality;
  popularity: number;
  genreMatch: string[];
  moodMatch: string[];
  difficulty: ScaleDifficulty;
}

export interface ChordProgression {
  romanNumerals: string[];
  exampleKey: string;
  moodTags: string[];
  genres: string[];
  energy: EnergyLevel;
  complexity: ScaleDifficulty;
  popularity: number;
}

export interface MoodKnowledge {
  name: string;
  suggestedKeys: string[];
  suggestedScales: string[];
  suggestedBpm: [number, number];
  suggestedChords: string[][];
  suggestedInstruments: string[];
}

export interface InstrumentKnowledge {
  name: string;
  category: string;
  genres: string[];
  moodMatch: string[];
  energyMatch: EnergyLevel[];
}

export interface PluginRecommendationKnowledge {
  category: string;
  description: string;
  instruments: string[];
  genres: string[];
  moods: string[];
}

export interface SongSection {
  name: string;
  bars: number;
}

export interface SongStructureKnowledge {
  name: string;
  genres: string[];
  sections: SongSection[];
}

export interface TimeSignatureKnowledge {
  signature: [number, number];
  description: string;
  genreRecommendations: string[];
}

export interface GenreKnowledge {
  name: string;
  description: string;
  bpmRange: [number, number];
  defaultBpm: number;
  commonKeys: string[];
  tonalityPreference: TonalityPreference;
  recommendedScales: string[];
  typicalStructure: string;
  chordProgressions: string[][];
  energyLevel: EnergyLevel;
  moodTags: string[];
  instrumentRecommendations: string[];
  pluginCategories: string[];
  difficulty: ScaleDifficulty;
}

export interface MusicRule {
  name: string;
  scope: string;
  rule: Record<string, unknown>;
  priority: number;
  active: boolean;
}

export interface KnowledgeSnapshot {
  genres: GenreKnowledge[];
  moods: MoodKnowledge[];
  scales: ScaleKnowledge[];
  keys: KeyKnowledge[];
  chords: ChordProgression[];
  instruments: InstrumentKnowledge[];
  plugins: PluginRecommendationKnowledge[];
  structures: SongStructureKnowledge[];
  tempoRanges: TempoRange[];
  timeSignatures: TimeSignatureKnowledge[];
  rules: MusicRule[];
}

export interface RecommendationInput {
  genre?: string;
  mood?: string;
  energy?: string;
  instrument?: string;
  tonality?: string;
}

export interface MusicRecommendation {
  genre: GenreKnowledge;
  tempo: TempoRange;
  keys: KeyKnowledge[];
  scales: ScaleKnowledge[];
  chordProgressions: ChordProgression[];
  moods: MoodKnowledge[];
  instruments: InstrumentKnowledge[];
  plugins: PluginRecommendationKnowledge[];
  structures: SongStructureKnowledge[];
  timeSignatures: TimeSignatureKnowledge[];
  rules: MusicRule[];
}

export interface SearchFilters {
  genre?: string;
  mood?: string;
  energy?: string;
  instrument?: string;
}

export interface SearchBestMatches {
  tempos: TempoRange[];
  keys: KeyKnowledge[];
  scales: ScaleKnowledge[];
  chords: ChordProgression[];
  instruments: InstrumentKnowledge[];
  plugins: PluginRecommendationKnowledge[];
}

export interface KnowledgeSearchResult {
  query: string;
  intent: SearchIntent;
  filters: SearchFilters;
  genres: GenreKnowledge[];
  moods: MoodKnowledge[];
  scales: ScaleKnowledge[];
  chords: ChordProgression[];
  instruments: InstrumentKnowledge[];
  plugins: PluginRecommendationKnowledge[];
  recommendations: MusicRecommendation[];
  best: SearchBestMatches;
}

export interface KnowledgeRepository {
  loadSnapshot(): Promise<KnowledgeSnapshot>;
}
