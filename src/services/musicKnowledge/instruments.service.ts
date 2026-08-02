import { knowledgeService } from "./knowledge.service.js";

export class InstrumentsKnowledgeService {
  async list() { return knowledgeService.instruments(); }
  async recommend(input: { genre?: string; mood?: string; energy?: string }) {
    return (await this.list()).filter((instrument) => (!input.genre || instrument.genres.includes(input.genre)) && (!input.mood || instrument.moodMatch.includes(input.mood)) && (!input.energy || instrument.energyMatch.includes(input.energy as never)));
  }
}

export const instrumentsKnowledgeService = new InstrumentsKnowledgeService();
