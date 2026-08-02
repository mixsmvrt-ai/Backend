import { knowledgeService } from "./knowledge.service.js";

export class KeysKnowledgeService {
  async list() { return knowledgeService.keys(); }
  async recommend(input: { genre?: string; mood?: string; tonality?: string }) {
    return (await this.list())
      .filter((key) => (!input.genre || key.genreMatch.includes(input.genre)) && (!input.mood || key.moodMatch.includes(input.mood)) && (!input.tonality || key.tonality.toLowerCase() === input.tonality.toLowerCase()))
      .sort((a, b) => b.popularity - a.popularity);
  }
}

export const keysKnowledgeService = new KeysKnowledgeService();
