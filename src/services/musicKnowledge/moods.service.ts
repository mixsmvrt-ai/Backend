import { knowledgeService } from "./knowledge.service.js";

export class MoodsKnowledgeService {
  async list() { return knowledgeService.moods(); }
  async find(name: string) { return (await this.list()).find((mood) => mood.name.toLowerCase() === name.toLowerCase()); }
}

export const moodsKnowledgeService = new MoodsKnowledgeService();
