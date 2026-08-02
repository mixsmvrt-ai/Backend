import { DEFAULT_HIGH_PASS_FREQUENCY_HZ } from "./constants.js";

export class NoiseReductionService {
  filters(options: { highPassEnabled: boolean }) {
    const filters = ["afftdn=nf=-25:nt=w"];
    if (options.highPassEnabled) {
      filters.push(`highpass=f=${DEFAULT_HIGH_PASS_FREQUENCY_HZ}`);
    }
    return filters;
  }
}

export const noiseReductionService = new NoiseReductionService();