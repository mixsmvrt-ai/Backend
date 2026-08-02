import { INSTRUMENT_HINTS, VIBE_ENERGY_MAP, VIBE_GROOVE_MAP, VIBE_MOOD_MAP } from "./constants.js";
import type { ExtractedVibe } from "./types.js";

function unique(values: string[]) {
  return [...new Set(values)];
}

function inferTarget(text: string): ExtractedVibe["target"] {
  if (/\bchords?\b/i.test(text)) return "chords";
  if (/\bbass(line)?\b/i.test(text)) return "bassline";
  if (/\bdrums?\b/i.test(text)) return "drums";
  if (/\b(full composition|arrangement|song)\b/i.test(text)) return "full composition";
  return "melody";
}

export class VibeExtractorService {
  extract(prompt: string): ExtractedVibe {
    const text = prompt.toLowerCase();
    const descriptors = Object.keys(VIBE_MOOD_MAP).filter((keyword) => text.includes(keyword));
    const moodTags = unique(descriptors.flatMap((keyword) => VIBE_MOOD_MAP[keyword] ?? []));
    const instrumentHints = unique(INSTRUMENT_HINTS.filter((hint) => text.includes(hint.toLowerCase())).map((hint) => hint === "Piano" ? "Bright Piano" : hint));
    const grooveStyle = descriptors.map((keyword) => VIBE_GROOVE_MAP[keyword]).find(Boolean);
    const energyLevel = descriptors.map((keyword) => VIBE_ENERGY_MAP[keyword]).find(Boolean);

    return {
      descriptors,
      moodTags,
      instrumentHints,
      grooveStyle,
      energyLevel,
      target: inferTarget(text),
    };
  }
}

export const vibeExtractorService = new VibeExtractorService();