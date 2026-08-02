import type { EnergyLevel } from "./types.js";

export class EnergyKnowledgeService {
  list(): EnergyLevel[] { return ["Very Low", "Low", "Medium", "High", "Extreme"]; }
  normalize(value?: string): EnergyLevel {
    const match = this.list().find((energy) => energy.toLowerCase() === value?.toLowerCase());
    return match ?? "Medium";
  }
}

export const energyKnowledgeService = new EnergyKnowledgeService();
