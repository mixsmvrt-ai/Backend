import { ARTIST_REFERENCE_PATTERNS } from "./constants.js";
import type { ArtistInspirationAnalysis } from "./types.js";

function sentenceCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export class PromptSanitizerService {
  sanitize(analysis: Omit<ArtistInspirationAnalysis, "sanitizedPrompt" | "originalityNotice">): string {
    const original = analysis.originalPrompt.trim().replace(/\s+/g, " ");
    const looksLikeArtistRequest = analysis.detectedArtists.length > 0 || ARTIST_REFERENCE_PATTERNS.some((pattern) => pattern.test(original));

    if (!looksLikeArtistRequest) {
      return original;
    }

    const moodPhrase = analysis.translatedMood.map((mood) => mood.toLowerCase()).join(", ");
    const instrumentPhrase = analysis.translatedInstruments.map((instrument) => instrument.toLowerCase()).join(", ");
    return [
      `Create an original ${analysis.translatedGenre.toLowerCase()} ${analysis.knowledgeGenre.toLowerCase()} ${analysis.grooveStyle.toLowerCase()} ${analysis.detectedArtists.length ? "artist-inspired" : "composition"} ${analysis.knowledgeRecommendations[0]?.genre.name ? `with ${analysis.knowledgeRecommendations[0].genre.name.toLowerCase()} harmonic grounding` : ""}.`,
      `Target around ${analysis.translatedTempo} BPM with ${analysis.translatedEnergy.toLowerCase()} energy.`,
      `Use ${sentenceCase(analysis.melodyStyle).toLowerCase()} melodic writing, ${analysis.rhythmStyle.toLowerCase()} rhythm, and ${analysis.productionStyle.toLowerCase()} production choices.`,
      `Focus on moods such as ${moodPhrase} with instruments including ${instrumentPhrase}.`,
      `Keep the harmony ${analysis.chordStyle.toLowerCase()}.`,
    ].join(" ").replace(/\s+/g, " ").trim();
  }
}

export const promptSanitizerService = new PromptSanitizerService();