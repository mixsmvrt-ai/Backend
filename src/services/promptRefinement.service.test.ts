import { describe, expect, it } from "vitest";
import { PromptRefinementEngine } from "./promptRefinement.service.js";

describe("PromptRefinementEngine", () => {
  const engine = new PromptRefinementEngine();

  it("asks no more than three high-impact questions for a vague prompt", () => {
    const result = engine.refine("make something dark");
    expect(result.shouldGenerate).toBe(false);
    expect(result.questions.length).toBeGreaterThan(0);
    expect(result.questions.length).toBeLessThanOrEqual(3);
    expect(new Set(result.questions.map((question) => question.id)).size).toBe(result.questions.length);
  });

  it("asks what to build first when the musical part is ambiguous", () => {
    const result = engine.refine("RajahWild x Shenseea type beat");
    expect(result.questions[0]?.id).toBe("part");
    expect(result.questions[0]?.options).toContain("Chords + Melody");
  });

  it("generates immediately when the prompt is complete", () => {
    const result = engine.refine("Kraff trap dancehall Spanish guitar aggressive 100 BPM F minor modern melody");
    expect(result.shouldGenerate).toBe(true);
    expect(result.questions).toHaveLength(0);
    expect(result.confidence).toBeGreaterThanOrEqual(0.88);
  });

  it("uses remembered project preferences to skip repeated questions", () => {
    const result = engine.refine("generate another", {
      genre: "Trap Dancehall",
      mood: "Emotional",
      bpm: 100,
      key: "F minor",
      instrument: "Dark Piano",
      complexity: "Modern",
    }, "chords");
    expect(result.questions.map((question) => question.id)).not.toContain("mood");
    expect(result.questions.map((question) => question.id)).not.toContain("instrument");
    expect(result.questions.map((question) => question.id)).not.toContain("tempo");
  });

  it("offers a custom BPM choice when tempo needs to be selected", () => {
    const result = engine.refine("make a dark dancehall melody");
    const tempoQuestion = result.questions.find((question) => question.id === "tempo");
    expect(tempoQuestion?.options).toContain("Custom BPM");
  });
});
