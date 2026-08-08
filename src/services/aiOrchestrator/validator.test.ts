import { describe, expect, it } from "vitest";
import { CompactPlanValidator } from "./validator.js";

const plan = (bars: number) => JSON.stringify({
  tempo: 100,
  key: "A",
  scale: "Minor",
  bars,
  time_signature: "4/4",
  tracks: [{ name: "Main Melody", instrument: "Piano", role: "melody", notes: [{ p: 69, s: 0, d: 1, v: 96 }] }],
  summary: "Hook-led producer idea",
});

describe("CompactPlanValidator", () => {
  it("rejects a non-voice plan with the wrong bar count", () => {
    expect(() => new CompactPlanValidator().validate(plan(16), 8)).toThrow("Expected exactly 8 bars");
  });

  it("allows voice plans to use a variable bar count", () => {
    expect(new CompactPlanValidator().validate(plan(16)).plan.bars).toBe(16);
  });
});
