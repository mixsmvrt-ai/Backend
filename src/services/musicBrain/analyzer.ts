import type { MusicBrainInput } from "./types.js";
import { validatePrompt } from "./validation.js";
import { genreProfilesService } from "./genreProfiles.js";
import { detectMood, inferEmotion, inferEnergy } from "./mood.js";
import { inferTempo } from "./tempo.js";
import { inferKey, inferScale } from "./key.js";
import { detectInstruments, recommendedPlugins } from "./instrument.js";
import { detectGenerationType } from "./intent.js";
import { inferComplexity, inferDifficulty, inferHumanization } from "./complexity.js";
import { inferSongLength, inferTimeSignature } from "./structure.js";
import type { MusicContext } from "./types.js";
import { musicBrainArtistCatalog } from "./artists.js";
import { buildJamaicanGenerationContext } from "./jamaicanKnowledge.js";

function selectArtistGenreHint(artistBlend: Awaited<ReturnType<typeof musicBrainArtistCatalog.resolvePrompt>>) {
  if (!artistBlend?.primaryGenres.length) return undefined;
  return artistBlend.primaryGenres.slice().sort((left, right) => right.length - left.length)[0];
}

function mergeOriginalityNotice(existing?: string) {
  const artistSafety = "Translate any artist reference into high-level musical characteristics only. Do not reproduce melodies, chord progressions, hooks, or recognizable phrases from any existing copyrighted work.";
  return [existing, artistSafety].filter(Boolean).join(" ");
}

export class MusicBrainAnalyzer {
  async analyze(input: MusicBrainInput): Promise<Omit<MusicContext, "enhancedPrompt">> {
    const prompt = validatePrompt(input.prompt);
    const artistBlend = await musicBrainArtistCatalog.resolvePrompt(prompt);
    const jamaicanKnowledge = buildJamaicanGenerationContext(prompt, { mood: input.mood, tempo: input.tempo, instrument: input.prompt.match(/spanish|nylon|guitar|piano|keys|bell|808|bass|pluck|pad/i)?.[0] });
    const genreHint = input.genre ?? selectArtistGenreHint(artistBlend) ?? jamaicanKnowledge.genreProfile?.genreName;
    const analysisPrompt = artistBlend
      ? `${prompt}. Artist vibe characteristics: ${artistBlend.primaryGenres.join(", ")}; ${artistBlend.instrumentPreferences.join(", ")}; ${artistBlend.mood.join(", ")}; ${artistBlend.rhythmStyle}.`
      : prompt;
    const genreProfile = await genreProfilesService.detect(analysisPrompt, genreHint);
    const genre = genreProfile.name;
    const mood = detectMood(analysisPrompt, input.mood ?? artistBlend?.supportedMood);
    const emotion = inferEmotion(analysisPrompt, mood);
    const energy = inferEnergy(analysisPrompt, genre, mood, artistBlend?.energy ?? genreProfile.energy);
    const tempoDecision = inferTempo(analysisPrompt, genre, mood, energy, input.tempo ?? artistBlend?.tempoRange.default, genreProfile);
    const key = inferKey(analysisPrompt, mood, input.key, artistBlend?.keyPreferences ?? []);
    const scale = inferScale(mood, input.scale, [...(artistBlend?.scalePreferences ?? []), ...genreProfile.primaryScales, ...genreProfile.secondaryScales]);
    const complexity = inferComplexity(analysisPrompt, input.complexity);
    const generationType = detectGenerationType(analysisPrompt, input.kind);
    const instrumentSuggestions = detectInstruments(analysisPrompt, genre, artistBlend?.instrumentPreferences.length ? artistBlend.instrumentPreferences : genreProfile.commonInstruments);
    const songLength = inferSongLength(analysisPrompt, input.lengthBars);
    const timeSignature = inferTimeSignature(prompt, input.timeSignature, genreProfile.commonTimeSignatures);
    const humanization = inferHumanization(complexity, energy, genreProfile.humanizationAmount);
    const style = [input.style, artistBlend ? `Artist vibe profile: ${artistBlend.summary}` : undefined].filter(Boolean).join(" ") || undefined;
    return {
      prompt,
      genre,
      genreProfile,
      artistBlend,
      mood,
      tempo: tempoDecision.tempo,
      tempoAdvisory: tempoDecision.advisory,
      key,
      scale,
      complexity,
      energy,
      emotion,
      generationType,
      instrumentSuggestions,
      songLength,
      humanization,
      timeSignature,
      recommendedPlugins: recommendedPlugins(instrumentSuggestions, genre, mood),
      style,
      originalityNotice: mergeOriginalityNotice(input.originalityNotice),
      difficulty: inferDifficulty(complexity, input.difficulty),
      daw: input.targetDaw,
      jamaicanKnowledge,
    };
  }
}
