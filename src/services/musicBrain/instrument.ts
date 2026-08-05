import { DEFAULT_INSTRUMENTS_BY_GENRE, INSTRUMENT_KEYWORDS } from "./constants.js";
import type { PluginRecommendation, SupportedGenre, SupportedMood } from "./types.js";

export function detectInstruments(prompt: string, genre: SupportedGenre, preferredInstruments: string[] = []) {
  const text = prompt.toLowerCase();
  const detected = Object.entries(INSTRUMENT_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => text.includes(keyword)))
    .map(([instrument]) => instrument);

  const merged = [...detected, ...(preferredInstruments.length ? preferredInstruments : DEFAULT_INSTRUMENTS_BY_GENRE[genre] ?? [])];
  return [...new Set(merged)].slice(0, 4);
}

export function recommendedPlugins(instruments: string[], genre: SupportedGenre, mood: SupportedMood): PluginRecommendation[] {
  return instruments.slice(0, 3).map((instrument) => ({
    instrumentType: instrument,
    presetType: presetFor(instrument, mood),
    genreMatch: genre,
    moodMatch: mood,
    alternative: alternativeFor(instrument),
  }));
}

function presetFor(instrument: string, mood: SupportedMood) {
  if (instrument === "808") return mood === "Dark" ? "dark 808 / sub bass" : "clean 808 / sub bass";
  if (/piano|rhodes/i.test(instrument)) return mood === "Sad" || mood === "Emotional" ? "felt or soft piano" : "warm or bright piano";
  if (/guitar/i.test(instrument)) return mood === "Dark" ? "clean electric guitar" : "ambient or melodic guitar";
  if (/bell|choir|strings/i.test(instrument)) return mood === "Dark" ? "dark ambient layer" : "cinematic layer";
  if (/pad|synth/i.test(instrument)) return mood === "Dreamy" ? "ambient pad" : "supporting synth texture";
  return `${mood.toLowerCase()} ${instrument.toLowerCase()} category`;
}

function alternativeFor(instrument: string) {
  if (instrument === "808") return "Sub bass";
  if (/piano/i.test(instrument)) return "Rhodes";
  if (/bell/i.test(instrument)) return "Pluck";
  if (/strings/i.test(instrument)) return "Pad";
  return "Layered synth";
}
