import { MOOD_KEYWORDS, SUPPORTED_MOODS } from "./constants.js";
import type { EnergyLevel, SupportedGenre, SupportedMood } from "./types.js";

export function detectMood(prompt: string, explicitMood?: string): SupportedMood {
  if (explicitMood) {
    const match = SUPPORTED_MOODS.find((mood) => mood.toLowerCase() === explicitMood.toLowerCase());
    if (match) return match;
  }

  const text = prompt.toLowerCase();
  for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS) as Array<[SupportedMood, string[]]>) {
    if (keywords.some((keyword) => text.includes(keyword))) return mood;
  }

  return "Emotional";
}

export function inferEmotion(prompt: string, mood: SupportedMood) {
  const text = prompt.toLowerCase();
  if (text.includes("emotional")) return "Emotional";
  if (text.includes("sad")) return "Sad";
  if (text.includes("happy")) return "Happy";
  if (text.includes("hope")) return "Hopeful";
  if (text.includes("angry")) return "Angry";
  return mood;
}

export function inferEnergy(prompt: string, genre: SupportedGenre, mood: SupportedMood, profileEnergy?: string): EnergyLevel {
  const text = prompt.toLowerCase();
  if (/\b(high energy|hype|energetic|aggressive|hard)\b/.test(text)) return "High";
  if (/\b(low energy|soft|calm|relaxed|chill)\b/.test(text)) return "Low";
  if (profileEnergy) {
    const normalized = profileEnergy.toLowerCase();
    if (normalized.includes("very low") || normalized.includes("low")) return "Low";
    if (normalized.includes("high") || normalized.includes("extreme")) return "High";
  }
  if (["EDM", "House", "Techno", "Dubstep", "Phonk"].includes(genre) || mood === "Energetic" || mood === "Aggressive") return "High";
  if (["LoFi", "Soul", "Classical"].includes(genre) || mood === "Calm" || mood === "Relaxed") return "Low";
  return "Medium";
}
