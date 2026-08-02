import { describe, expect, it } from "vitest";
import { analyzeHarmony } from "./harmonyAnalyzer.js";
import { createPitchAnalysisFixture } from "./testFixtures.js";

describe("harmonyAnalyzer", () => {
  it("suggests a structured chord progression with roman numerals", () => {
    const result = analyzeHarmony(createPitchAnalysisFixture());
    expect(result.chordProgression.length).toBeGreaterThan(0);
    expect(result.chordProgression[0]?.romanNumeral).toBeTruthy();
    expect(result.alternativeProgressions.length).toBeGreaterThan(0);
  });
});