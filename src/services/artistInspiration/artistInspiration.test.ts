import { describe, expect, it } from "vitest";
import { artistInspirationService, artistDetectionService, configureArtistProfileRepository, createStaticArtistProfileRepository, publicArtistInspiredContext } from "./index.js";

describe("Artist Inspiration Engine", () => {
  it("detects referenced artists in prompts", async () => {
    const result = await artistDetectionService.detect("Skippa type melody with bouncy piano");
    expect(result.map((item) => item.artistName)).toContain("Skippa");
  });

  it("translates artist prompts into generalized characteristics", async () => {
    const analysis = await artistInspirationService.analyze({ prompt: "Metro Boomin style dark trap bells" });
    const result = publicArtistInspiredContext(analysis);
    expect(result.detectedArtists).toContain("Metro Boomin");
    expect(result.translatedGenre).toBe("Cinematic Trap");
    expect(result.translatedMood).toContain("Dark");
    expect(result.translatedInstruments).toEqual(expect.arrayContaining(["Bell", "808"]));
    expect(result.sanitizedPrompt.toLowerCase()).not.toContain("metro boomin");
  });

  it("sanitizes exact artist imitation into original direction", async () => {
    const analysis = await artistInspirationService.analyze({ prompt: "Make the exact Skippa melody" });
    expect(analysis.sanitizedPrompt.toLowerCase()).toContain("create an original");
    expect(analysis.sanitizedPrompt.toLowerCase()).not.toContain("skippa");
  });

  it("rejects direct copying requests", async () => {
    await expect(artistInspirationService.analyze({ prompt: "Use the same notes as that exact song" })).rejects.toThrow("direct copying");
  });

  it("can be configured with a static repository", async () => {
    configureArtistProfileRepository(createStaticArtistProfileRepository());
    await expect(artistInspirationService.profile("The Weeknd")).resolves.toMatchObject({ primaryGenre: "Dark Synth R&B" });
  });
});