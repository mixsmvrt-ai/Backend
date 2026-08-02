import { describe, expect, it } from "vitest";
import { analyzeMotifs } from "./motifAnalyzer.js";
import { createPitchAnalysisFixture } from "./testFixtures.js";

describe("motifAnalyzer", () => {
  it("finds repeated motifs and transposed sequences", () => {
    const result = analyzeMotifs(createPitchAnalysisFixture());
    expect(result.motifs.length).toBeGreaterThan(0);
    expect(result.sequences.length).toBeGreaterThan(0);
  });
});