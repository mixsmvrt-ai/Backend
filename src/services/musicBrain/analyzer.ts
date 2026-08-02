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

export class MusicBrainAnalyzer {
  async analyze(input: MusicBrainInput): Promise<Omit<MusicContext, "enhancedPrompt">> {
    const prompt = validatePrompt(input.prompt);
    const genreProfile = await genreProfilesService.detect(prompt, input.genre);
    const genre = genreProfile.name;
    const mood = detectMood(prompt, input.mood);
    const emotion = inferEmotion(prompt, mood);
    const energy = inferEnergy(prompt, genre, mood, genreProfile.energy);
    const tempoDecision = inferTempo(prompt, genre, mood, energy, input.tempo, genreProfile);
    const key = inferKey(prompt, mood, input.key, []);
    const scale = inferScale(mood, input.scale, [...genreProfile.primaryScales, ...genreProfile.secondaryScales]);
    const complexity = inferComplexity(prompt, input.complexity);
    const generationType = detectGenerationType(prompt, input.kind);
    const instrumentSuggestions = detectInstruments(prompt, genre, genreProfile.commonInstruments);
    const songLength = inferSongLength(prompt, input.lengthBars);
    const timeSignature = inferTimeSignature(prompt, input.timeSignature, genreProfile.commonTimeSignatures);
    const humanization = inferHumanization(complexity, energy, genreProfile.humanizationAmount);
    return {
      prompt,
      genre,
      genreProfile,
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
      style: input.style,
      originalityNotice: input.originalityNotice,
      difficulty: inferDifficulty(complexity, input.difficulty),
      daw: input.targetDaw,
    };
  }
}
