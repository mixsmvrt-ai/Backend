import { env } from "../../config/env.js";
import { DEFAULT_PROVIDER } from "./constants.js";
import type { PitchDetectionProvider } from "./pitch.interface.js";
import type { PitchProviderName } from "./types.js";
import { PitchAnalysisError } from "./types.js";
import { AubioProvider } from "./providers/aubio.provider.js";
import { CrepeProvider } from "./providers/crepe.provider.js";
import { EssentiaProvider } from "./providers/essentia.provider.js";

export class PitchProviderFactory {
  constructor(private readonly providers: PitchDetectionProvider[] = [new AubioProvider(), new CrepeProvider(), new EssentiaProvider()]) {}

  defaultProvider() {
    return this.resolve(env.PITCH_DEFAULT_PROVIDER ?? DEFAULT_PROVIDER);
  }

  resolve(provider: PitchProviderName | undefined) {
    const target = provider ?? (env.PITCH_DEFAULT_PROVIDER as PitchProviderName | undefined) ?? DEFAULT_PROVIDER;
    const match = this.providers.find((entry) => entry.name === target);
    if (!match) {
      throw new PitchAnalysisError(`Unsupported pitch detection provider: ${target}`, "PITCH_UNSUPPORTED_PROVIDER", 422);
    }
    return match;
  }
}

export const pitchProviderFactory = new PitchProviderFactory();