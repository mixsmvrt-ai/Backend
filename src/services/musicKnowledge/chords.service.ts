import { knowledgeService } from "./knowledge.service.js";

export class ChordsKnowledgeService {
  async list() { return knowledgeService.chords(); }
  async recommend(input: { genre?: string; mood?: string; energy?: string }) {
    return (await this.list())
      .filter((chord) => (!input.genre || chord.genres.includes(input.genre)) && (!input.mood || chord.moodTags.includes(input.mood)) && (!input.energy || chord.energy === input.energy))
      .sort((a, b) => b.popularity - a.popularity);
  }
}

export const chordsKnowledgeService = new ChordsKnowledgeService();
