import { describe, expect, it } from "vitest";
import { analyzeGenres } from "./genreAnalyzer.js";
import { createPitchAnalysisFixture } from "./testFixtures.js";

describe("genreAnalyzer", () => {
  it("returns ranked genre confidence scores", () => {
    const result = analyzeGenres(createPitchAnalysisFixture());
    expect(result[0].confidence).toBeGreaterThanOrEqual(result[1].confidence);
    expect(result.some((entry) => entry.genre === "Pop")).toBe(true);
  });
});