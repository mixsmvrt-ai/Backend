import { chordsKnowledgeService } from "./chords.service.js";
import { genreKnowledgeService } from "./genre.service.js";
import { instrumentsKnowledgeService } from "./instruments.service.js";
import { knowledgeService } from "./knowledge.service.js";
import { keysKnowledgeService } from "./keys.service.js";
import { moodsKnowledgeService } from "./moods.service.js";
import { pluginsKnowledgeService } from "./plugins.service.js";
import { scalesKnowledgeService } from "./scales.service.js";
import { songStructureKnowledgeService } from "./songStructure.service.js";
import { tempoKnowledgeService } from "./tempo.service.js";
import { timeSignatureKnowledgeService } from "./timeSignature.service.js";
import type { MusicRecommendation, RecommendationInput } from "./types.js";

export class RecommendationKnowledgeService {
  async recommend(input: RecommendationInput): Promise<MusicRecommendation[]> {
    const genres = input.genre ? await genreKnowledgeService.match(input.genre) : (await genreKnowledgeService.list()).slice(0, 5);
    const moods = await moodsKnowledgeService.list();
    const rules = await knowledgeService.rules();

    return Promise.all(genres.map(async (genre) => ({
      genre,
      tempo: (await tempoKnowledgeService.forGenre(genre.name)) ?? { genre: genre.name, minBpm: genre.bpmRange[0], maxBpm: genre.bpmRange[1], defaultBpm: genre.defaultBpm },
      keys: (await keysKnowledgeService.recommend({ genre: genre.name, mood: input.mood, tonality: input.tonality })).slice(0, 5),
      scales: (await scalesKnowledgeService.recommend({ genre: genre.name, mood: input.mood })).slice(0, 5),
      chordProgressions: (await chordsKnowledgeService.recommend({ genre: genre.name, mood: input.mood, energy: input.energy })).slice(0, 5),
      moods: input.mood ? moods.filter((mood) => mood.name === input.mood) : moods.filter((mood) => genre.moodTags.includes(mood.name)),
      instruments: (await instrumentsKnowledgeService.recommend({ genre: genre.name, mood: input.mood, energy: input.energy })).slice(0, 6),
      plugins: (await pluginsKnowledgeService.recommend({ genre: genre.name, mood: input.mood, instrument: input.instrument })).slice(0, 6),
      structures: await songStructureKnowledgeService.recommend(genre.name),
      timeSignatures: await timeSignatureKnowledgeService.recommend(genre.name),
      rules: rules.filter((rule) => rule.scope === "general" || rule.scope === "plugins" || rule.scope === "tempo" || rule.scope === "key-selection"),
    })));
  }
}

export const recommendationKnowledgeService = new RecommendationKnowledgeService();
