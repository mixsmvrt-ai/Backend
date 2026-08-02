import { GENERATION_TYPE_KEYWORDS } from "./constants.js";
import type { GenerationType } from "./types.js";

const kindMap: Record<string, GenerationType> = {
  melody: "Melody",
  chords: "Chord Progression",
  counter_melody: "Counter Melody",
  bassline: "Bassline",
  drums: "Drums",
  full_composition: "Full Composition",
};

export function detectGenerationType(prompt: string, kind?: string): GenerationType {
  if (kind && kindMap[kind]) return kindMap[kind];
  const text = prompt.toLowerCase();
  for (const [type, keywords] of Object.entries(GENERATION_TYPE_KEYWORDS) as Array<[GenerationType, string[]]>) {
    if (keywords.some((keyword) => text.includes(keyword))) return type;
  }
  return "Melody";
}
