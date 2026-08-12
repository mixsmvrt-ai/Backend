import { describe, expect, it } from "vitest";
import { ResponseValidator, validateStructuredMusicQuality } from "./responseValidator.js";

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

  it("rejects notes that stop before the requested form ends", () => {
    const music = {
      tempo: 100,
      key: "A",
      scale: "Minor",
      timeSignature: [4, 4] as [number, number],
      trackName: "Test",
      notes: Array.from({ length: 8 }, (_, index) => ({ pitch: 60 + index, startBeat: index * 0.5, durationBeats: 0.25, velocity: 90 })),
      chordProgression: ["Am7"],
      structure: [{ name: "Hook", bars: 8 }],
      pluginRecommendations: [],
    };
    expect(() => validateStructuredMusicQuality(music, 8, "full_composition")).toThrow("full 8-bar form");
  });

  it("accepts a melody that covers the complete eight-bar form", () => {
    const music = {
      tempo: 100,
      key: "A",
      scale: "Minor",
      timeSignature: [4, 4] as [number, number],
      trackName: "Test",
      notes: Array.from({ length: 16 }, (_, index) => ({ pitch: 60 + (index % 5), startBeat: index * 2, durationBeats: 0.75, velocity: 90 })),
      chordProgression: ["Am7", "Fmaj7"],
      structure: [{ name: "Hook", bars: 8 }],
      pluginRecommendations: [],
    };
    expect(validateStructuredMusicQuality(music, 8, "full_composition")).toBe(music);
  });
});