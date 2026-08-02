import { SUPPORTED_KNOWLEDGE_GENRES } from "./constants.js";
import type { ArtistEnergyLevel, ArtistProfile, DetectedArtistReference, ExtractedVibe } from "./types.js";

export interface TranslatedArtistStyle {
  originalPrompt: string;
  detectedArtists: string[];
  translatedGenre: string;
  knowledgeGenre: string;
  translatedMood: string[];
  knowledgeMood?: string;
  translatedTempo: number;
  translatedEnergy: ArtistEnergyLevel;
  translatedInstruments: string[];
  grooveStyle: string;
  melodyStyle: string;
  rhythmStyle: string;
  productionStyle: string;
  chordStyle: string;
  target: ExtractedVibe["target"];
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function inferKnowledgeGenre(prompt: string): string {
  const text = prompt.toLowerCase();
  const match = SUPPORTED_KNOWLEDGE_GENRES.find((genre) => text.includes(genre.toLowerCase()));
  return match ?? "Pop";
}

function inferGenreLabel(prompt: string, profile?: ArtistProfile): string {
  if (profile) return profile.primaryGenre;
  if (/\bdancehall\b/i.test(prompt) && /\btrap\b/i.test(prompt)) return "Dancehall Trap";
  if (/\bafro\b/i.test(prompt)) return "Afrobeats";
  if (/\bdrill\b/i.test(prompt)) return "Drill";
  if (/\btrap\b/i.test(prompt)) return "Trap";
  if (/\br&b\b/i.test(prompt) || /\brnb\b/i.test(prompt)) return "R&B";
  return "Contemporary";
}

function inferTempo(prompt: string, profile?: ArtistProfile): number {
  const explicit = prompt.match(/\b(\d{2,3})\s?bpm\b/i);
  if (explicit) return Number(explicit[1]);
  if (profile) {
    if (/\bslow|laid back|chill\b/i.test(prompt)) return profile.tempoMin;
    if (/\bfast|upbeat|hype|energy\b/i.test(prompt)) return profile.tempoMax;
    return profile.defaultTempo;
  }
  return 100;
}

export class StyleTranslatorService {
  translate(prompt: string, detected: DetectedArtistReference[], vibe: ExtractedVibe): TranslatedArtistStyle {
    const primary = detected[0]?.profile;
    const translatedGenre = inferGenreLabel(prompt, primary);
    const knowledgeGenre = primary?.knowledgeGenres[0] ?? inferKnowledgeGenre(prompt);
    const translatedMood = unique([...(vibe.moodTags.length ? vibe.moodTags : []), ...(primary?.moodTags ?? [])]).slice(0, 4);
    const translatedEnergy = vibe.energyLevel ?? primary?.energyLevel ?? "Medium";
    const translatedInstruments = unique([...(vibe.instrumentHints.length ? vibe.instrumentHints : []), ...(primary?.instrumentTags ?? [])]).slice(0, 6);
    const grooveStyle = vibe.grooveStyle ?? primary?.grooveStyle ?? "Balanced";
    const melodyStyle = primary?.melodyStyle ?? "Original motif-led writing";
    const productionStyle = primary?.productionStyle ?? "Clean modern production";
    const rhythmStyle = primary?.rhythmStyle ?? "Supportive contemporary rhythm";
    const chordStyle = primary?.chordStyle ?? "Flexible modern harmony";

    return {
      originalPrompt: prompt,
      detectedArtists: detected.map((item) => item.artistName),
      translatedGenre,
      knowledgeGenre,
      translatedMood: translatedMood.length ? translatedMood : ["Emotional"],
      knowledgeMood: translatedMood[0],
      translatedTempo: inferTempo(prompt, primary),
      translatedEnergy,
      translatedInstruments: translatedInstruments.length ? translatedInstruments : ["Keys"],
      grooveStyle,
      melodyStyle,
      rhythmStyle,
      productionStyle,
      chordStyle,
      target: vibe.target,
    };
  }
}

export const styleTranslatorService = new StyleTranslatorService();