import { describe, expect, it } from "vitest";
import { ResponseValidator } from "./responseValidator.js";

describe("ResponseValidator", () => {
  it("accepts structured AI composition JSON", () => {
    const validator = new ResponseValidator();
    const payload = JSON.stringify({
      genre: "Pop",
      mood: "Dreamy",
      tempo: 108,
      key: "C",
      scale: "major",
      timeSignature: [4, 4],
      trackName: "Test",
      melody: [{ pitch: 60, startBeat: 0, durationBeats: 1, velocity: 90 }],
      chordProgression: [{ symbol: "Cmaj7", romanNumeral: "I", startBar: 1, bars: 2, function: "tonic" }],
      bassline: [],
      counterMelody: [],
      arrangement: [{ name: "Intro", bars: 4, elements: ["melody"] }],
      pluginCategories: ["lead synth"],
      productionNotes: ["Keep it airy"],
      variationSuggestions: ["Add octave lift in bar 8"],
      confidence: 0.82,
    });
    expect(validator.validate(payload).response.genre).toBe("Pop");
  });
});