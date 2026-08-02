import { chordsKnowledgeService } from "./chords.service.js";
import { genreKnowledgeService } from "./genre.service.js";
import { instrumentsKnowledgeService } from "./instruments.service.js";
import { knowledgeService } from "./knowledge.service.js";
import { pluginsKnowledgeService } from "./plugins.service.js";
import { recommendationKnowledgeService } from "./recommendation.service.js";
import { tempoKnowledgeService } from "./tempo.service.js";
import { keysKnowledgeService } from "./keys.service.js";
import { scalesKnowledgeService } from "./scales.service.js";
import type { KnowledgeSearchResult, SearchFilters, SearchIntent } from "./types.js";

function detectIntent(text: string): SearchIntent {
  if (text.includes("bpm") || text.includes("tempo")) return "tempo";
  if (text.includes("key")) return "key";
  if (text.includes("scale")) return "scale";
  if (text.includes("chord")) return "chord";
  if (text.includes("instrument")) return "instrument";
  if (text.includes("plugin")) return "plugin";
  if (text.includes("genre")) return "genre";
  return "general";
}

export class SearchKnowledgeService {
  async search(query: string): Promise<KnowledgeSearchResult> {
    const text = query.trim().toLowerCase();
    const includes = (values: string[]) => values.some((value) => text.includes(value.toLowerCase()) || value.toLowerCase().includes(text));
    const intent = detectIntent(text);
    const genres = await genreKnowledgeService.match(text);
    const moods = (await knowledgeService.moods()).filter((mood) => text.includes(mood.name.toLowerCase()));
    const scales = (await knowledgeService.scales()).filter((scale) => includes([scale.name, ...scale.moodTags, ...scale.genres]));
    const chords = (await chordsKnowledgeService.list()).filter((chord) => includes([...chord.genres, ...chord.moodTags, chord.exampleKey]));
    const instruments = (await instrumentsKnowledgeService.list()).filter((instrument) => includes([instrument.name, instrument.category, ...instrument.genres, ...instrument.moodMatch]));
    const plugins = (await pluginsKnowledgeService.list()).filter((plugin) => includes([plugin.category, ...plugin.genres, ...plugin.moods, ...plugin.instruments]));
    const filters: SearchFilters = { genre: genres[0]?.name, mood: moods[0]?.name, instrument: instruments[0]?.name };
    const recommendations = (await recommendationKnowledgeService.recommend({ genre: filters.genre, mood: filters.mood, instrument: filters.instrument })).slice(0, 3);
    return {
      query,
      intent,
      filters,
      genres,
      moods,
      scales,
      chords,
      instruments,
      plugins,
      recommendations,
      best: {
        tempos: filters.genre ? [await tempoKnowledgeService.forGenre(filters.genre)].filter(Boolean) as Awaited<ReturnType<typeof tempoKnowledgeService.list>> : [],
        keys: (await keysKnowledgeService.recommend({ genre: filters.genre, mood: filters.mood })).slice(0, 5),
        scales: (await scalesKnowledgeService.recommend({ genre: filters.genre, mood: filters.mood })).slice(0, 5),
        chords: (await chordsKnowledgeService.recommend({ genre: filters.genre, mood: filters.mood })).slice(0, 5),
        instruments: (await instrumentsKnowledgeService.recommend({ genre: filters.genre, mood: filters.mood })).slice(0, 6),
        plugins: (await pluginsKnowledgeService.recommend({ genre: filters.genre, mood: filters.mood, instrument: filters.instrument })).slice(0, 6),
      },
    };
  }
}

export const searchKnowledgeService = new SearchKnowledgeService();
