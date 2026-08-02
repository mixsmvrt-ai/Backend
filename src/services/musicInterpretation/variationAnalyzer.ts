import type { MusicInterpretationResult, VariationSuggestion } from "./types.js";

export function analyzeVariations(interpretation: Pick<MusicInterpretationResult, "phraseAnalysis" | "motifAnalysis" | "intervalAnalysis" | "melodyAnalysis" | "harmony">): VariationSuggestion[] {
  const suggestions: VariationSuggestion[] = [];
  if (interpretation.motifAnalysis.motifs.length > 0) {
    suggestions.push({ category: "melodic", suggestion: "Sequence the main motif up a third in the response phrase.", reason: "Repeated motifs already support recognisable development." });
  }
  if (interpretation.intervalAnalysis.contour === "smooth") {
    suggestions.push({ category: "rhythmic", suggestion: "Add a syncopated pickup before the last phrase to increase momentum.", reason: "The melody is smooth and can support more rhythmic lift." });
  }
  if (interpretation.harmony.chordProgression.length > 0) {
    suggestions.push({ category: "harmonic", suggestion: "Use a passing predominant chord before the dominant in the turnaround.", reason: "The current harmonic path leaves room for stronger tension release." });
  }
  if (interpretation.melodyAnalysis.descriptor.isHook) {
    suggestions.push({ category: "arrangement", suggestion: "Double the hook one octave higher in the final phrase.", reason: "The melody already contains a memorable repeated idea." });
  }
  return suggestions;
}