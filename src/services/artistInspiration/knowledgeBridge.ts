import { recommendationKnowledgeService } from "../musicKnowledge/index.js";
import type { ArtistInspirationAnalysis } from "./types.js";
import type { TranslatedArtistStyle } from "./styleTranslator.js";

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeEnergy(value: string | undefined) {
  if (!value) return undefined;
  if (value === "Medium High") return "High";
  return value;
}

export class KnowledgeBridgeService {
  async enrich(style: TranslatedArtistStyle): Promise<Omit<ArtistInspirationAnalysis, "sanitizedPrompt" | "originalityNotice">> {
    const knowledgeRecommendations = await recommendationKnowledgeService.recommend({
      genre: style.knowledgeGenre,
      mood: style.knowledgeMood,
      energy: normalizeEnergy(style.translatedEnergy),
      instrument: style.translatedInstruments[0],
    });
    const primary = knowledgeRecommendations[0];

    return {
      originalPrompt: style.originalPrompt,
      detectedArtists: style.detectedArtists,
      translatedGenre: style.translatedGenre,
      translatedMood: style.translatedMood,
      translatedTempo: primary?.tempo.defaultBpm ?? style.translatedTempo,
      translatedEnergy: style.translatedEnergy,
      translatedInstruments: unique([...style.translatedInstruments, ...(primary?.instruments.map((instrument) => instrument.name) ?? [])]).slice(0, 6),
      grooveStyle: style.grooveStyle,
      melodyStyle: style.melodyStyle,
      productionStyle: style.productionStyle,
      knowledgeGenre: primary?.genre.name ?? style.knowledgeGenre,
      knowledgeMood: style.knowledgeMood,
      knowledgeRecommendations,
      rhythmStyle: style.rhythmStyle,
      chordStyle: style.chordStyle,
    };
  }
}

export const knowledgeBridgeService = new KnowledgeBridgeService();