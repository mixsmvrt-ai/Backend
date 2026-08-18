import { describe, expect, it } from "vitest";
import { aggregateArtistStyle, buildJamaicanGenerationContext, detectJamaicanArtists, detectJamaicanGenre, selectReferencePacks } from "./jamaicanKnowledge.js";

describe("Jamaican Knowledge Engine", () => {
  it("detects the curated Jamaican artists and genre", () => {
    expect(detectJamaicanArtists("Kraff Spanish guitar")).toEqual([]);
    expect(detectJamaicanArtists("Shenseea x Valiant dancehall melody").map((profile) => profile.artistName)).toEqual(["Shenseea", "Valiant"]);
    expect(detectJamaicanGenre("modern trap dancehall piano")?.genreName).toBe("Modern Trap Dancehall");
  });

  it("blends multiple known artists and gives explicit instruments retrieval priority", () => {
    const context = buildJamaicanGenerationContext("Masicka x Valiant Spanish guitar", { instrument: "Spanish Guitar" });
    expect(context.artistProfile?.artistName).toBe("Valiant x Masicka");
    expect(context.generationConstraints.originalComposition).toBe(true);
    expect(context.referenceFeatures[0]?.pack).toBe("Spanish Guitar MIDI Pack");
  });

  it("randomizes weighted reference selection without exposing source melodies", () => {
    const context = buildJamaicanGenerationContext("Tommy Lee Sparta dark piano");
    const first = selectReferencePacks(context.artistProfile as never, context.genreProfile, context.userPreferences.prompt, () => 0.01);
    const second = selectReferencePacks(context.artistProfile as never, context.genreProfile, context.userPreferences.prompt, () => 0.91);
    expect(first.length).toBeGreaterThan(0);
    expect(second.length).toBeGreaterThan(0);
    expect(first.map((entry) => entry.pack)).not.toEqual(second.map((entry) => entry.pack));
    expect(context.artistProfile).not.toHaveProperty("songs");
  });

  it("aggregates analyzed song features instead of treating one song as the artist", () => {
    const result = aggregateArtistStyle([
      { tempo: 98, confidence: 0.9, melodyDensity: 0.3, syncopation: 0.7, instruments: ["piano", "bass"], register: "mid" },
      { tempo: 104, confidence: 0.8, melodyDensity: 0.5, syncopation: 0.5, instruments: ["piano", "guitar"], register: "mid" },
      { tempo: null, confidence: 0, melodyDensity: 0.4, syncopation: 0.6, instruments: ["guitar"], register: "high" },
    ]);
    expect(result.tempo).toEqual({ min: 98, max: 104, preferred: 101 });
    expect(result.instrumentWeights).toEqual({ piano: 0.667, bass: 0.333, guitar: 0.667 });
    expect(result.frequencies.mid).toBe(2);
  });

  it("covers every requested artist and preserves unknown-artist fallback", () => {
    const prompts = ["Shenseea catchy dancehall melody", "Spice dancehall melody", "Mavado dark piano", "Armanii emotional piano", "Valiant bouncy piano", "Merkz dark piano", "Popcaan dancehall guitar", "Tommy Lee Sparta dark piano", "Beenie Man dancehall melody", "Bounty Killer dancehall piano", "Masicka emotional guitar", "Teejay dancehall guitar", "Rajahwild energetic melody", "Teebone trap dancehall piano", "Jamal trap dancehall piano", "Vybz Kartel dark dancehall piano", "Eddy G Bomba dancehall guitar"];
    expect(prompts.every((prompt) => detectJamaicanArtists(prompt).length > 0)).toBe(true);
    const fallback = buildJamaicanGenerationContext("Kraff trap dancehall Spanish guitar");
    expect(fallback.artistProfile).toBeNull();
    expect(fallback.genreProfile?.genreName).toBe("Trap Dancehall");
    expect(fallback.instrumentProfile?.name).toMatch(/spanish/i);
    expect(fallback.generationConstraints.explicitUserDirectionWins).toBe(true);
  });
});