import { knowledgeService } from "./knowledge.service.js";

export class TempoKnowledgeService {
  async list() { return knowledgeService.tempoRanges(); }
  async forGenre(genre: string) { return (await this.list()).find((tempo) => tempo.genre.toLowerCase() === genre.toLowerCase()); }
}

export const tempoKnowledgeService = new TempoKnowledgeService();
