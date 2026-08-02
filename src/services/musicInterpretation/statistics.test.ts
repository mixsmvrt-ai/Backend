import { describe, expect, it } from "vitest";
import { analyzePhrases } from "./phraseAnalyzer.js";
import { complexityScore } from "./statistics.js";
import { createPitchAnalysisFixture } from "./testFixtures.js";

describe("statistics", () => {
  it("scores melodic complexity", () => {
    const analysis = createPitchAnalysisFixture();
    const phrases = analyzePhrases(analysis);
    const result = complexityScore(analysis, phrases.phrases.length);
    expect(["Beginner", "Intermediate", "Advanced", "Professional"]).toContain(result.level);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});