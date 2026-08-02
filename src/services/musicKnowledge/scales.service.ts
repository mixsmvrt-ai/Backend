import { knowledgeService } from "./knowledge.service.js";

export class ScalesKnowledgeService {
  async list() { return knowledgeService.scales(); }
  async recommend(input: { genre?: string; mood?: string }) {
    return (await this.list()).filter((scale) => (!input.genre || scale.genres.includes(input.genre)) && (!input.mood || scale.moodTags.includes(input.mood)));
  }
}

export const scalesKnowledgeService = new ScalesKnowledgeService();
