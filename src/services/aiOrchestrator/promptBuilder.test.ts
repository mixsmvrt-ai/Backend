import { describe, expect, it } from "vitest";
import { buildCompactPlannerPrompt } from "./promptBuilder.js";
import type { BuiltAiContext } from "../ai/types.js";

function context(): BuiltAiContext {
  return {
    prompt: "Dark dancehall melody",
    sanitizedPrompt: "Dark dancehall melody",
    musicBrain: {
      context: {
        genre: "Dancehall",
        mood: "Dark",
        tempo: 100,
        key: "A",
        scale: "Natural Minor",
        energy: "Medium",
        complexity: "Advanced",
        timeSignature: [4, 4],
        tempoAdvisory: null,
      } as never,
      providerPrompt: "",
    },
    interpretation: null,
    artist: {
      translatedGenre: "Dancehall",
      translatedMood: ["Dark"],
      translatedTempo: 100,
      translatedInstruments: ["Piano"],
      grooveStyle: "syncopated",
      melodyStyle: "hook-first",
      productionStyle: "spacious",
      originalityNotice: "Create original music.",
      sanitizedPrompt: "Dark dancehall melody",
      knowledgeGenre: "Dancehall",
    },
    knowledge: [],
    projectHistory: [],
    userPreferences: undefined,
  };
}

describe("compact planner prompt", () => {
  it("requires producer-level hooks, groove, space, and human feel", () => {
    const result = buildCompactPlannerPrompt(context(), {
      workflow: "text_to_midi",
      bars: 8,
      requestedTracks: [{ name: "Main Melody", role: "melody" }],
    });

    expect(result.systemPrompt).toContain("strong hook");
    expect(result.systemPrompt).toContain("vocal space");
    expect(result.systemPrompt).toContain("Humanize");
    expect(result.systemPrompt).toContain("modern harmonic color");
    expect(result.systemPrompt).toContain("exactly 8 bars");
  });

  it("turns Spanish guitar chord requests into melodic playable parts", () => {
    const result = buildCompactPlannerPrompt({ ...context(), sanitizedPrompt: "Kraff-inspired Spanish guitar chord melody for trap dancehall" }, {
      workflow: "text_to_midi",
      bars: 8,
      requestedTracks: [{ name: "Spanish Guitar Chords", role: "chords", instrument: "Nylon Guitar" }],
    });

    expect(result.systemPrompt).toContain("arpeggiate or break chord tones");
    expect(result.systemPrompt).toContain("Do not return only sustained block chords");
  });
});
