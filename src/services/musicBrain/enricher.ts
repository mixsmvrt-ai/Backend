import { recommendationKnowledgeService } from "../musicKnowledge/index.js";
import type { MusicContext } from "./types.js";

export class MusicBrainEnricher {
  async enrich(context: Omit<MusicContext, "enhancedPrompt">): Promise<MusicContext> {
    const knowledge = (await recommendationKnowledgeService.recommend({
      genre: context.genre,
      mood: context.mood,
      energy: context.energy,
      instrument: context.instrumentSuggestions[0],
    }))[0];

    const chordProgressions = knowledge?.chordProgressions.map((progression) => progression.romanNumerals.join("-")) ?? [];
    const scales = knowledge?.scales.map((scale) => scale.name) ?? [context.scale];
    const plugins = [...new Set([...(context.artistBlend?.pluginCategories ?? []), ...(knowledge?.plugins.map((plugin) => plugin.category) ?? context.recommendedPlugins.map((plugin) => plugin.presetType))])];
    const instruments = [...new Set([...context.instrumentSuggestions, ...(knowledge?.instruments.map((instrument) => instrument.name) ?? [])])].slice(0, 6);
    const genreProfile = context.genreProfile;

    const enhancedPrompt = [
      `Create a ${context.generationType.toLowerCase()} for a ${context.genre} project.`,
      context.artistBlend ? `Artist vibe translation: ${context.artistBlend.summary}` : "",
      `Mood: ${context.mood}; emotion: ${context.emotion}; energy: ${context.energy}.`,
      `Tempo: ${context.tempo} BPM; key: ${context.key}; scale: ${context.scale}.`,
      context.tempoAdvisory?.message ? `Tempo note: ${context.tempoAdvisory.message}` : "",
      `Song length: ${context.songLength}; time signature: ${context.timeSignature.join("/")}; complexity: ${context.complexity}; humanization: ${context.humanization}.`,
      context.artistBlend?.arrangementTendencies.length ? `Arrangement tendencies: ${context.artistBlend.arrangementTendencies.join(", ")}.` : "",
      context.artistBlend?.productionTraits.length ? `Production traits: ${context.artistBlend.productionTraits.join(", ")}.` : "",
      genreProfile ? `Genre profile: ${genreProfile.description} Groove=${genreProfile.groove}; bass=${genreProfile.bassStyle}; melody density=${genreProfile.melodyDensity}; rhythm complexity=${genreProfile.rhythmComplexity}; chord complexity=${genreProfile.chordComplexity}; brightness=${genreProfile.brightness}; aggressiveness=${genreProfile.aggressiveness}.` : "",
      genreProfile?.commonIntervals.length ? `Common interval language: ${genreProfile.commonIntervals.join(", ")}.` : "",
      genreProfile?.typicalNoteLengths.length ? `Typical note lengths: ${genreProfile.typicalNoteLengths.join(", ")}.` : "",
      `Recommended instruments: ${instruments.join(", ")}.`,
      chordProgressions.length ? `Recommended harmonic vocabulary: ${chordProgressions.join(", ")}.` : "",
      scales.length ? `Compatible scales: ${scales.join(", ")}.` : "",
      plugins.length ? `Production categories: ${plugins.join(", ")}.` : "",
      `Interpreted intent: ${context.genre} ${context.mood.toLowerCase()} ${context.generationType.toLowerCase()} led by ${instruments[0] ?? "a suitable primary instrument"}.`,
    ].filter(Boolean).join("\n");

    return {
      ...context,
      enhancedPrompt,
      instrumentSuggestions: instruments,
      recommendedPlugins: knowledge?.plugins.map((plugin) => ({
        instrumentType: plugin.instruments[0] ?? context.instrumentSuggestions[0] ?? "Instrument",
        presetType: plugin.category,
        genreMatch: context.genre,
        moodMatch: context.mood,
        alternative: plugin.description,
      })) ?? context.recommendedPlugins,
    };
  }
}
