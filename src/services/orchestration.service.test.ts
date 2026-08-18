import { describe, expect, it } from "vitest";
import { titleFromGenerationRequest } from "./orchestration.service.js";

describe("generation request titles", () => {
  it("uses the user's request instead of a model-invented title", () => {
    expect(titleFromGenerationRequest("Create a trap dancehall piano melody at 102 BPM")).toBe("trap dancehall piano melody at 102 BPM");
  });

  it("removes command wording and safely truncates long requests", () => {
    const title = titleFromGenerationRequest("Please generate an emotional Jamaican guitar melody with spacious syncopation and a warm vocal-friendly arrangement.");
    expect(title).toMatch(/^emotional Jamaican guitar melody/);
    expect(title.length).toBeLessThanOrEqual(64);
    expect(title).not.toMatch(/[.!?]/);
  });
});