import { artistDetectionService } from "./artistDetection.js";
import { artistProfileCatalog, configureArtistProfileRepository, createStaticArtistProfileRepository } from "./artistMapping.js";
import { knowledgeBridgeService } from "./knowledgeBridge.js";
import { originalityGuardService } from "./originalityGuard.js";
import { promptSanitizerService } from "./promptSanitizer.js";
import { styleTranslatorService } from "./styleTranslator.js";
import type { ArtistInspiredContext, ArtistInspirationAnalysis } from "./types.js";
import { vibeExtractorService } from "./vibeExtractor.js";

export class ArtistInspirationService {
  async analyze(input: { prompt: string; userId?: string | null }): Promise<ArtistInspirationAnalysis> {
    const prompt = input.prompt.trim().replace(/\s+/g, " ");
    originalityGuardService.assertAllowed(prompt);
    const detected = await artistDetectionService.detect(prompt);
    const vibe = vibeExtractorService.extract(prompt);
    const translated = styleTranslatorService.translate(prompt, detected, vibe);
    const bridged = await knowledgeBridgeService.enrich(translated);
    const sanitizedPrompt = promptSanitizerService.sanitize(bridged);
    const originalityNotice = originalityGuardService.notice();
    const analysis: ArtistInspirationAnalysis = {
      ...bridged,
      sanitizedPrompt,
      originalityNotice,
    };

    await artistProfileCatalog.log({
      userId: input.userId,
      originalPrompt: prompt,
      sanitizedPrompt,
      detectedArtists: analysis.detectedArtists,
      translatedContext: publicArtistInspiredContext(analysis),
      rejected: false,
    });

    return analysis;
  }

  async logRejected(input: { prompt: string; reason: string; userId?: string | null }) {
    await artistProfileCatalog.log({
      userId: input.userId,
      originalPrompt: input.prompt,
      sanitizedPrompt: input.prompt,
      detectedArtists: [],
      translatedContext: {
        originalPrompt: input.prompt,
        detectedArtists: [],
        translatedGenre: "Contemporary",
        translatedMood: [],
        translatedTempo: 0,
        translatedEnergy: "Medium",
        translatedInstruments: [],
        grooveStyle: "Balanced",
        melodyStyle: "Original",
        productionStyle: "Clean",
        sanitizedPrompt: input.prompt,
        originalityNotice: originalityGuardService.notice(),
      },
      rejected: true,
      rejectionReason: input.reason,
    });
  }

  async profiles() {
    return artistProfileCatalog.profiles();
  }

  async profile(name: string) {
    return artistProfileCatalog.findByName(name);
  }

  async search(query: string) {
    return artistProfileCatalog.search(query);
  }
}

export function publicArtistInspiredContext(analysis: ArtistInspirationAnalysis): ArtistInspiredContext {
  return {
    originalPrompt: analysis.originalPrompt,
    detectedArtists: analysis.detectedArtists,
    translatedGenre: analysis.translatedGenre,
    translatedMood: analysis.translatedMood,
    translatedTempo: analysis.translatedTempo,
    translatedEnergy: analysis.translatedEnergy,
    translatedInstruments: analysis.translatedInstruments,
    grooveStyle: analysis.grooveStyle,
    melodyStyle: analysis.melodyStyle,
    productionStyle: analysis.productionStyle,
    sanitizedPrompt: analysis.sanitizedPrompt,
    originalityNotice: analysis.originalityNotice,
  };
}

export const artistInspirationService = new ArtistInspirationService();

export * from "./types.js";
export * from "./constants.js";
export * from "./artistDetection.js";
export * from "./artistMapping.js";
export * from "./styleTranslator.js";
export * from "./vibeExtractor.js";
export * from "./originalityGuard.js";
export * from "./promptSanitizer.js";
export * from "./knowledgeBridge.js";
export { configureArtistProfileRepository, createStaticArtistProfileRepository };