import type { MusicRecommendation } from "../musicKnowledge/types.js";

export type ArtistEnergyLevel = "Low" | "Medium" | "Medium High" | "High" | "Extreme";
export type CharacteristicType = "groove" | "melody" | "rhythm" | "production" | "chord" | "swing" | "originality";

export interface ArtistCharacteristic {
  type: CharacteristicType;
  value: string;
  priority: number;
}

export interface ArtistProfile {
  artistName: string;
  aliases: string[];
  primaryGenre: string;
  secondaryGenre?: string;
  knowledgeGenres: string[];
  tempoMin: number;
  tempoMax: number;
  defaultTempo: number;
  energyLevel: ArtistEnergyLevel;
  moodTags: string[];
  instrumentTags: string[];
  grooveStyle: string;
  melodyStyle: string;
  rhythmStyle: string;
  productionStyle: string;
  chordStyle: string;
  description: string;
  characteristics: ArtistCharacteristic[];
}

export interface ArtistProfileSnapshot {
  profiles: ArtistProfile[];
}

export interface DetectedArtistReference {
  artistName: string;
  matchedText: string;
  score: number;
  profile: ArtistProfile;
}

export interface ExtractedVibe {
  descriptors: string[];
  moodTags: string[];
  instrumentHints: string[];
  grooveStyle?: string;
  energyLevel?: ArtistEnergyLevel;
  target: "melody" | "chords" | "bassline" | "drums" | "full composition";
}

export interface ArtistInspiredContext {
  originalPrompt: string;
  detectedArtists: string[];
  translatedGenre: string;
  translatedMood: string[];
  translatedTempo: number;
  translatedEnergy: string;
  translatedInstruments: string[];
  grooveStyle: string;
  melodyStyle: string;
  productionStyle: string;
  sanitizedPrompt: string;
  originalityNotice: string;
}

export interface ArtistInspirationAnalysis extends ArtistInspiredContext {
  knowledgeGenre: string;
  knowledgeMood?: string;
  knowledgeRecommendations: MusicRecommendation[];
  rhythmStyle: string;
  chordStyle: string;
}

export interface ArtistTranslationLogRecord {
  userId?: string | null;
  originalPrompt: string;
  sanitizedPrompt: string;
  detectedArtists: string[];
  translatedContext: ArtistInspiredContext;
  rejected: boolean;
  rejectionReason?: string;
}

export interface ArtistProfileRepository {
  loadSnapshot(): Promise<ArtistProfileSnapshot>;
  logTranslation(record: ArtistTranslationLogRecord): Promise<void>;
}

export class ArtistInspirationError extends Error {
  readonly code: "ARTIST_INSPIRATION_ERROR" | "ARTIST_ORIGINALITY_VIOLATION" = "ARTIST_INSPIRATION_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "ArtistInspirationError";
  }
}

export class ArtistOriginalityViolationError extends ArtistInspirationError {
  readonly code = "ARTIST_ORIGINALITY_VIOLATION";

  constructor(message: string) {
    super(message);
    this.name = "ArtistOriginalityViolationError";
  }
}