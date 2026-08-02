import { describe, expect, it } from "vitest";
import { analyzePhrases } from "./phraseAnalyzer.js";
import { createPitchAnalysisFixture } from "./testFixtures.js";

describe("phraseAnalyzer", () => {
  it("detects phrase boundaries and repeated ideas", () => {
    const analysis = createPitchAnalysisFixture();
    const result = analyzePhrases(analysis);
    expect(result.phrases.length).toBeGreaterThanOrEqual(2);
    expect(result.repeatedIdeas.length).toBeGreaterThan(0);
    expect(result.openingPhraseId).not.toBeNull();
    expect(result.endingPhraseId).not.toBeNull();
  });
});