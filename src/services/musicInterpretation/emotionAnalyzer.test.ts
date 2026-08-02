import { describe, expect, it } from "vitest";
import { analyzeEmotion } from "./emotionAnalyzer.js";
import { createPitchAnalysisFixture } from "./testFixtures.js";

describe("emotionAnalyzer", () => {
  it("estimates a stable emotional palette", () => {
    const result = analyzeEmotion(createPitchAnalysisFixture());
    expect(result.primary).toBeTruthy();
    expect(result.palette.length).toBeGreaterThan(1);
    expect(result.confidence).toBeGreaterThan(0);
  });
});