import { PROVIDER_TUNINGS } from "../constants.js";
import { analyzeProcessedWav } from "../analysis.js";
import type { PitchDetectionProvider } from "../pitch.interface.js";

export class AubioProvider implements PitchDetectionProvider {
  readonly name = "aubio" as const;

  analyze(filePath: string, source: Parameters<typeof analyzeProcessedWav>[1], threshold: number) {
    return analyzeProcessedWav(filePath, source, this.name, PROVIDER_TUNINGS[this.name], threshold);
  }
}