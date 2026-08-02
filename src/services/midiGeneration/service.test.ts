import { describe, expect, it } from "vitest";
import type { OrchestrationInput } from "../../domain/music.js";
import { MidiGenerationService } from "./service.js";
import type { AiComposition } from "../ai/types.js";

const composition: AiComposition = {
  genre: "Pop",
  mood: "Dreamy",
  tempo: 110,
  key: "C",
  scale: "major",
  timeSignature: [4, 4],
  trackName: "Skyline",
  melody: [
    { pitch: 60, startBeat: 0, durationBeats: 1, velocity: 88 },
    { pitch: 64, startBeat: 1, durationBeats: 1, velocity: 86 },
    { pitch: 67, startBeat: 2, durationBeats: 2, velocity: 90 },
  ],
  chordProgression: [
    { symbol: "Cmaj7", romanNumeral: "I", startBar: 1, bars: 2, function: "tonic" },
    { symbol: "Am7", romanNumeral: "vi", startBar: 3, bars: 2, function: "submediant" },
  ],
  bassline: [],
  counterMelody: [],
  arrangement: [
    { name: "Intro", bars: 2, elements: ["melody"] },
    { name: "Hook", bars: 2, elements: ["melody", "chords", "bassline", "drums"] },
  ],
  pluginCategories: ["Warm Piano", "Analog Bass"],
  productionNotes: ["Keep the attack soft"],
  variationSuggestions: ["Lift the last hook phrase"],
  confidence: 0.82,
};

describe("MidiGenerationService", () => {
  it("builds single, multi-track, and package exports", () => {
    const service = new MidiGenerationService();
    const input: OrchestrationInput = {
      prompt: "Dreamy pop cue",
      kind: "full_composition",
      pluginSuggestions: true,
      lengthBars: 4,
      complexity: "medium",
      variationAmount: 0.5,
      timeSignature: [4, 4],
    };

    const result = service.build(input, composition, "generation-1");

    expect(result.tracks.map((track) => track.role)).toEqual(["melody", "chords", "bassline", "counter_melody", "drums"]);
    expect(result.legacyMusic.notes.length).toBeGreaterThan(0);
    expect(result.exports.map((file) => file.kind)).toEqual(["single", "multi", "package"]);
    expect(result.exports.find((file) => file.kind === "single")?.buffer.subarray(0, 4).toString()).toBe("MThd");
    expect(result.exports.find((file) => file.kind === "package")?.buffer.subarray(0, 2).toString("hex")).toBe("504b");
  });
});