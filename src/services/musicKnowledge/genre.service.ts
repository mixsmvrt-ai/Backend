import { knowledgeService } from "./knowledge.service.js";

export class GenreKnowledgeService {
  async list() { return knowledgeService.genres(); }
  async find(name: string) { return (await this.list()).find((genre) => genre.name.toLowerCase() === name.toLowerCase()); }
  async match(query: string) {
    const text = query.toLowerCase();
    return (await this.list()).filter((genre) => genre.name.toLowerCase().includes(text) || genre.moodTags.some((mood) => text.includes(mood.toLowerCase())));
  }
}

export const genreKnowledgeService = new GenreKnowledgeService();
