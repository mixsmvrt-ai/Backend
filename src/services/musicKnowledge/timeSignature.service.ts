import { knowledgeService } from "./knowledge.service.js";

export class TimeSignatureKnowledgeService {
  async list() { return knowledgeService.timeSignatures(); }
  async recommend(genre?: string) { return (await this.list()).filter((signature) => !genre || signature.genreRecommendations.includes(genre)); }
}

export const timeSignatureKnowledgeService = new TimeSignatureKnowledgeService();
