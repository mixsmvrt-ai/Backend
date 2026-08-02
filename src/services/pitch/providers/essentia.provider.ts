import { PROVIDER_TUNINGS } from "../constants.js";
import { analyzeProcessedWav } from "../analysis.js";
import type { PitchDetectionProvider } from "../pitch.interface.js";

export class EssentiaProvider implements PitchDetectionProvider {
  readonly name = "essentia" as const;

  analyze(filePath: string, source: Parameters<typeof analyzeProcessedWav>[1], threshold: number) {
    return analyzeProcessedWav(filePath, source, this.name, PROVIDER_TUNINGS[this.name], threshold);
  }
}