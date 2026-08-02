import { describe, expect, it } from "vitest";
import { genreKnowledgeService, recommendationKnowledgeService, searchKnowledgeService, tempoKnowledgeService } from "./index.js";

describe("Music Knowledge Engine", () => {
  it("provides Trap tempo knowledge", async () => {
    await expect(tempoKnowledgeService.forGenre("Trap")).resolves.toMatchObject({ minBpm: 140, maxBpm: 150, defaultBpm: 145 });
  });

  it("returns genre-specific recommendations", async () => {
    const recommendation = (await recommendationKnowledgeService.recommend({ genre: "Afrobeats", mood: "Happy" }))[0];
    expect(recommendation.genre.name).toBe("Afrobeats");
    expect(recommendation.tempo.defaultBpm).toBe(102);
    expect(recommendation.instruments.some((instrument) => instrument.name.includes("Guitar") || instrument.category === "Bell")).toBe(true);
  });

  it("searches across genres and production categories", async () => {
    const result = await searchKnowledgeService.search("best key for dark trap");
    expect(result.genres.some((genre) => genre.name === "Trap")).toBe(true);
    expect(result.intent).toBe("key");
    expect(result.best.keys.some((key) => key.tonality === "Minor")).toBe(true);
  });

  it("matches canonical genres", async () => {
    await expect(genreKnowledgeService.find("LoFi")).resolves.toMatchObject({ defaultBpm: 74 });
  });
});
