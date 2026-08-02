import { TEMPO_BY_GENRE } from "./constants.js";
import type { EnergyLevel, GenreProfile, SupportedGenre, SupportedMood, TempoAdvisory } from "./types.js";

export function detectExplicitTempo(prompt: string) {
  const match = prompt.match(/\b([4-9]\d|1\d{2}|2[0-3]\d|240)\s*(bpm|tempo)?\b/i);
  return match ? Number(match[1]) : undefined;
}

export function inferTempo(prompt: string, genre: SupportedGenre, mood: SupportedMood, energy: EnergyLevel, explicitTempo?: number, genreProfile?: GenreProfile | null): { tempo: number; advisory: TempoAdvisory | null } {
  const detected = explicitTempo ?? detectExplicitTempo(prompt);
  if (detected && Number.isInteger(detected) && detected >= 40 && detected <= 240) {
    if (genreProfile && (detected < genreProfile.tempoMin || detected > genreProfile.tempoMax)) {
      return {
        tempo: detected,
        advisory: {
          requestedTempo: detected,
          minTempo: genreProfile.tempoMin,
          maxTempo: genreProfile.tempoMax,
          message: `${genreProfile.name} usually sits around ${genreProfile.tempoMin}-${genreProfile.tempoMax} BPM, but MidiFlow will honor ${detected} BPM.`,
        },
      };
    }
    return { tempo: detected, advisory: null };
  }

  if (/\bhalf[- ]?time\b/i.test(prompt)) return { tempo: 72, advisory: null };
  if (genre === "Trap" && mood === "Sad" && /\bpiano\b/i.test(prompt)) return { tempo: 72, advisory: null };

  if (genreProfile) {
    if (energy === "High") return { tempo: Math.min(genreProfile.tempoMax, genreProfile.defaultTempo + 4), advisory: null };
    if (energy === "Low") return { tempo: Math.max(genreProfile.tempoMin, genreProfile.defaultTempo - 4), advisory: null };
    return { tempo: genreProfile.defaultTempo, advisory: null };
  }

  const [low, high] = TEMPO_BY_GENRE[genre];
  const midpoint = Math.round((low + high) / 2);
  if (energy === "High") return { tempo: Math.min(high, midpoint + 4), advisory: null };
  if (energy === "Low") return { tempo: Math.max(low, midpoint - 6), advisory: null };
  return { tempo: midpoint, advisory: null };
}
