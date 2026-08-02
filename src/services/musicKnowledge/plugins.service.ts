import { knowledgeService } from "./knowledge.service.js";

export class PluginsKnowledgeService {
  async list() { return knowledgeService.plugins(); }
  async recommend(input: { genre?: string; mood?: string; instrument?: string }) {
    return (await this.list()).filter((plugin) => (!input.genre || plugin.genres.includes(input.genre)) && (!input.mood || plugin.moods.includes(input.mood)) && (!input.instrument || plugin.instruments.some((instrument) => instrument.toLowerCase().includes(input.instrument!.toLowerCase()))));
  }
}

export const pluginsKnowledgeService = new PluginsKnowledgeService();
