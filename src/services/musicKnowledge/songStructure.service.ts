import { knowledgeService } from "./knowledge.service.js";

export class SongStructureKnowledgeService {
  async list() { return knowledgeService.structures(); }
  async recommend(genre?: string) { return (await this.list()).filter((structure) => !genre || structure.genres.includes(genre)); }
}

export const songStructureKnowledgeService = new SongStructureKnowledgeService();
