import { describe, expect, it } from "vitest";
import { AiOrchestrationError } from "./ai/types.js";
import { midiTitleFromGenerationRequest, shouldRetryGenerationAttempt, titleFromGenerationRequest } from "./orchestration.service.js";

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

  it("creates a professional instrument-role-tonality title", () => {
    expect(midiTitleFromGenerationRequest("I want Spanish guitar melody", "melody", { key: "A", scale: "Minor", tempo: 98 })).toBe("Spanish Guitar Melody A Minor - 98 BPM");
  });
});

describe("generation retry policy", () => {
  it("does not retry provider timeouts", () => {
    const timeout = new AiOrchestrationError("MIDI generation timed out.", "AI_TIMEOUT", 504, true);

    expect(shouldRetryGenerationAttempt(timeout, 0, 1)).toBe(false);
  });

  it("does not retry malformed model output", () => {
    const invalid = new AiOrchestrationError("Invalid composition.", "AI_INVALID_RESPONSE", 502, true);

    expect(shouldRetryGenerationAttempt(invalid, 0, 1)).toBe(false);
  });

  it("still retries retryable non-timeout failures", () => {
    const transient = new AiOrchestrationError("Temporary provider failure.", "AI_PROVIDER_TEMPORARY_FAILURE", 503, true);

    expect(shouldRetryGenerationAttempt(transient, 0, 1)).toBe(true);
    expect(shouldRetryGenerationAttempt(transient, 1, 1)).toBe(false);
  });
});