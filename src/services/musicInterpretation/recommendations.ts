import { recommendationKnowledgeService } from "../musicKnowledge/recommendation.service.js";
import type { MusicInterpretationResult, RecommendationSet } from "./types.js";

export async function buildRecommendations(interpretation: Pick<MusicInterpretationResult, "genreConfidence" | "emotion" | "energy" | "scaleAnalysis" | "keyAnalysis" | "harmony" | "groove" | "complexity" | "variationAnalysis" | "phraseAnalysis" | "melodyAnalysis">): Promise<RecommendationSet> {
  const topGenre = interpretation.genreConfidence[0]?.genre ?? null;
  const knowledge = topGenre
    ? await recommendationKnowledgeService.recommend({ genre: topGenre, mood: interpretation.emotion.primary, energy: interpretation.energy.level, tonality: interpretation.scaleAnalysis.currentScale ?? undefined })
    : [];
  const primary = knowledge[0];
  const chordOptions = primary?.chordProgressions?.map((entry) => entry.romanNumerals.join("-")).slice(0, 4) ?? interpretation.harmony.chordProgression.map((entry) => entry.chordName);
  const instrumentCategories = primary?.instruments?.map((entry) => entry.name).slice(0, 6) ?? ["lead synth", "keys", "plucks", "pads"];
  const productionIdeas = [
    `${interpretation.groove.primary} groove with ${interpretation.energy.level.toLowerCase()} dynamic automation.`,
    `Use ${interpretation.emotion.primary.toLowerCase()} voicing layers to reinforce the melodic mood.`,
    primary?.plugins?.[0] ? `Design the lead around ${primary.plugins[0].category.toLowerCase()}-style tone shaping.` : "Blend a focused lead with a supportive pad layer.",
  ];
  const arrangementIdeas = [
    interpretation.phraseAnalysis.questionAnswerPairs.length > 0 ? "Contrast the answer phrase with lighter instrumentation." : "Build contrast between phrase 1 and the closing phrase.",
    interpretation.variationAnalysis[0]?.suggestion ?? "Reserve the widest register statement for the final section.",
    interpretation.complexity.level === "Beginner" ? "Keep the main hook exposed with sparse accompaniment." : "Let harmony widen gradually across repeated phrases.",
  ];
  return {
    betterKey: interpretation.keyAnalysis.alternatives[0] ?? interpretation.keyAnalysis.currentKey,
    alternativeTempo: primary?.tempo?.defaultBpm ?? null,
    alternativeScale: interpretation.scaleAnalysis.alternatives[0] ?? interpretation.scaleAnalysis.currentScale,
    chordOptions,
    instrumentCategories,
    productionIdeas,
    arrangementIdeas,
    counterMelody: {
      direction: interpretation.melodyAnalysis.descriptor.motion === "angular" ? "oblique" : "contrary",
      register: interpretation.melodyAnalysis.register === "high" ? "mid register" : "upper register",
      rhythm: interpretation.groove.primary === "Straight" ? "off-beat supportive line" : "sparser complementary rhythm",
      complexity: interpretation.complexity.level,
    },
    bassline: {
      rootMotion: interpretation.harmony.chordProgression.map((entry) => entry.romanNumeral),
      octavePlacement: interpretation.energy.level === "Extreme" || interpretation.energy.level === "High" ? "low octave with occasional octave jumps" : "mid-low octave with smooth transitions",
      groove: interpretation.groove.primary,
      patternIdeas: [
        interpretation.groove.primary === "Syncopated" ? "accent the off-beats around phrase turnarounds" : "lock with phrase downbeats",
        interpretation.harmony.chordProgression[0] ? `outline ${interpretation.harmony.chordProgression[0].chordName} before each cadence` : "follow tonic-dominant root motion",
      ],
    },
  };
}