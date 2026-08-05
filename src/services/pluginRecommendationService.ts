import { loadMusicBrainKnowledge, type InstrumentKnowledge, type PluginKnowledge } from "../music-brain/loader.js";
import type { MidiAnalysisSummary } from "./midiAnalysisService.js";

export interface RankedPluginRecommendation {
  rank: number;
  plugin: string;
  category: string;
  reason: string;
}

function categoryForAnalysis(analysis: MidiAnalysisSummary, question: string) {
  const lowerQuestion = question.toLowerCase();
  if (lowerQuestion.includes("bass") || lowerQuestion.includes("808")) return "sub bass";
  if (lowerQuestion.includes("pad")) return "cinematic pad";
  if (lowerQuestion.includes("bell")) return "bell texture";
  if (analysis.registerFocus === "mid" && analysis.emotionalProfile.includes("dark")) return "felt piano";
  if (analysis.energyLevel === "high") return "dark piano";
  if (analysis.registerFocus === "high") return "soft lead";
  return "soft grand";
}

function moodMatches(plugin: PluginKnowledge, mood: string) {
  return plugin.moods.some((value) => value.toLowerCase().includes(mood.toLowerCase()));
}

function genreMatches(plugin: PluginKnowledge, genre: string | null) {
  if (!genre) return false;
  return plugin.genres.some((value) => value.toLowerCase() === genre.toLowerCase());
}

function findInstrumentHint(instruments: InstrumentKnowledge[], category: string) {
  return instruments.find((instrument) => instrument.name.toLowerCase() === category.toLowerCase() || instrument.aliases.some((alias) => alias.toLowerCase() === category.toLowerCase()));
}

export class PluginRecommendationService {
  async recommend(input: { analysis: MidiAnalysisSummary; genre: string | null; question: string; preferredCategories?: string[] }) {
    const knowledge = await loadMusicBrainKnowledge();
    const preferredCategory = input.preferredCategories?.find(Boolean);
    const category = preferredCategory ?? categoryForAnalysis(input.analysis, input.question);
    const instrumentHint = findInstrumentHint(knowledge.instruments, category);
    const ranked = knowledge.plugins
      .map((plugin) => {
        let score = 0;
        if (plugin.soundCategories.some((soundCategory) => soundCategory.toLowerCase().includes(category.toLowerCase()))) score += 5;
        if (input.preferredCategories?.some((preferred) => plugin.soundCategories.some((soundCategory) => soundCategory.toLowerCase().includes(preferred.toLowerCase())))) score += 3;
        if (genreMatches(plugin, input.genre)) score += 3;
        if (moodMatches(plugin, input.analysis.emotionalProfile)) score += 2;
        if (plugin.producerUseCases.some((useCase) => useCase.toLowerCase().includes("main") || useCase.toLowerCase().includes("layer"))) score += 1;
        if (input.analysis.energyLevel === "low" && plugin.cpu !== "high") score += 1;
        return { plugin, score };
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, 5)
      .map(({ plugin }, index) => ({
        rank: index + 1,
        plugin: plugin.name,
        category,
        reason: `${plugin.name} fits because it is strong for ${plugin.soundCategories.slice(0, 2).join(" and ")} and lines up with a ${input.analysis.emotionalProfile} ${input.analysis.registerFocus}-register idea.${instrumentHint ? ` ${instrumentHint.name} layers well with ${instrumentHint.layering[0]}.` : ""}`,
      }));

    return ranked;
  }
}

export const pluginRecommendationService = new PluginRecommendationService();