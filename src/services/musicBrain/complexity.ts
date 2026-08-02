import { COMPLEXITY_KEYWORDS, HUMANIZATION_BY_COMPLEXITY } from "./constants.js";
import type { ComplexityLevel, DifficultyLevel, EnergyLevel, HumanizationLevel } from "./types.js";

const inputMap: Record<string, ComplexityLevel> = {
  low: "Simple",
  simple: "Simple",
  medium: "Medium",
  high: "Advanced",
  advanced: "Advanced",
  expert: "Expert",
};

export function inferComplexity(prompt: string, explicit?: string): ComplexityLevel {
  if (explicit && inputMap[explicit.toLowerCase()]) return inputMap[explicit.toLowerCase()];
  const text = prompt.toLowerCase();
  for (const [complexity, keywords] of Object.entries(COMPLEXITY_KEYWORDS) as Array<[ComplexityLevel, string[]]>) {
    if (keywords.some((keyword) => text.includes(keyword))) return complexity;
  }
  return "Medium";
}

export function inferDifficulty(complexity: ComplexityLevel, explicit?: string): DifficultyLevel {
  if (explicit && /advanced/i.test(explicit)) return "Advanced";
  if (explicit && /beginner/i.test(explicit)) return "Beginner";
  if (complexity === "Simple") return "Beginner";
  if (complexity === "Expert" || complexity === "Advanced") return "Advanced";
  return "Intermediate";
}

export function inferHumanization(complexity: ComplexityLevel, energy: EnergyLevel, genreHumanizationAmount?: number): HumanizationLevel {
  if (typeof genreHumanizationAmount === "number") {
    if (genreHumanizationAmount >= 0.5) return "High";
    if (genreHumanizationAmount <= 0.2) return "Low";
  }
  if (energy === "Low") return "High";
  return HUMANIZATION_BY_COMPLEXITY[complexity];
}
