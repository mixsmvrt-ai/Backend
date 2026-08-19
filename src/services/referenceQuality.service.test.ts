import { describe, expect, it } from "vitest";
import type { OrchestrationInput, StructuredMusic } from "../domain/music.js";
import type { RetrievedReference } from "./referenceLibrary/service.js";
import { applyReferenceQualityGate } from "./referenceQuality.service.js";

const input: OrchestrationInput = {
  prompt: "sparse dancehall melody",
  kind: "melody",
  lengthBars: 8,
  complexity: "medium",
  variationAmount: 0.5,
  timeSignature: [4, 4],
  pluginSuggestions: false,
};

const reference = {
  collection: "dancehall",
  fileName: "guitar.mid",
  tempo: 100,
  key: "G",
  scale: "Minor",
  score: 4,
  influence: 0.7,
  byteLength: 100,
  profile: {
    noteDensity: 0.2,
    rhythmicDensity: 0.2,
    restRatio: 0.5,
    durationDistribution: "0.5-1 beats",
    velocityVariation: 0.1,
    pitchRange: { min: 60, max: 72 },
    register: "mid",
    phraseLength: 2,
    repetitionLevel: 0.7,
    complexity: 0.3,
    syncopationLevel: 0.5,
    chordVoicingStyle: "compact voicings",
  },
  midiEvents: Array.from({ length: 8 }, (_, index) => ({ pitch: 60, startBeat: index * 4, durationBeats: 0.5, velocity: 90, track: "Guitar", bar: index + 1, beatPosition: 0, phrasePosition: 1, role: "melody" })),
} satisfies RetrievedReference;

function music(noteCount: number): StructuredMusic {
  return {
    tempo: 100,
    key: "G",
    scale: "Minor",
    timeSignature: [4, 4],
    trackName: "Idea",
    notes: Array.from({ length: noteCount }, (_, index) => ({ pitch: 60 + (index % 5), startBeat: index * 0.5, durationBeats: 0.25, velocity: 90 })),
    chordProgression: [],
    structure: [{ name: "Main", bars: 8 }],
    pluginRecommendations: [],
  };
}

describe("reference quality gate", () => {
  it("simplifies output that is denser than the primary reference", () => {
    const result = applyReferenceQualityGate(music(40), reference, input);
    expect(result.simplified).toBe(true);
    expect(result.music.notes.length).toBeLessThan(40);
  });

  it("preserves requested complexity", () => {
    const result = applyReferenceQualityGate(music(40), reference, { ...input, prompt: "complex dense melody", complexity: "high" });
    expect(result.simplified).toBe(false);
    expect(result.music.notes).toHaveLength(40);
  });
});
