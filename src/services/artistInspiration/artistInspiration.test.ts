import { describe, expect, it } from "vitest";
import { artistInspirationService, artistDetectionService, configureArtistProfileRepository, createStaticArtistProfileRepository, publicArtistInspiredContext } from "./index.js";

describe("Artist Inspiration Engine", () => {
  it("detects referenced artists in prompts", async () => {
    const result = await artistDetectionService.detect("Skippa type melody with bouncy piano");
    expect(result.map((item) => item.artistName)).toContain("Skippa");
  });

  it("detects Feloni19 across common generation prompts", async () => {
    for (const prompt of [
      "Feloni19 type melody",
      "Feloni19 trap dancehall piano",
      "Feloni19 dark guitar",
      "Feloni19 emotional keys",
    ]) {
      const result = await artistDetectionService.detect(prompt);
      expect(result.map((item) => item.artistName)).toContain("Feloni19");
    }
  });

  it("translates Feloni19 into an original vibe profile", async () => {
    const analysis = await artistInspirationService.analyze({ prompt: "Feloni19 emotional keys" });
    expect(analysis.detectedArtists).toContain("Feloni19");
    expect(analysis.sanitizedPrompt.toLowerCase()).not.toContain("feloni19");
    expect(analysis.originalityNotice.toLowerCase()).toContain("original");
    expect(analysis.translatedInstruments).toEqual(expect.arrayContaining(["Dark Piano", "Emotional Piano"]));
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