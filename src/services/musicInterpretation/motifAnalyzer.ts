import type { PitchAnalysisResult } from "../pitch/types.js";
import type { MotifAnalysisResult, MotifMatch } from "./types.js";

function motifKey(notes: PitchAnalysisResult["detectedNotes"], start: number, length: number) {
  const slice = notes.slice(start, start + length);
  const intervals = slice.slice(1).map((note, index) => note.midi - slice[index].midi).join(",");
  const rhythm = slice.map((note) => note.duration.toFixed(2)).join(",");
  return { intervals, rhythm };
}

export function analyzeMotifs(analysis: PitchAnalysisResult): MotifAnalysisResult {
  const notes = analysis.detectedNotes;
  const motifs: MotifMatch[] = [];
  const sequences: string[] = [];
  const transformations: string[] = [];

  for (let length = 3; length <= 4; length += 1) {
    const seen = new Map<string, number[]>();
    for (let start = 0; start + length <= notes.length; start += 1) {
      const key = motifKey(notes, start, length);
      const exactKey = `exact:${key.intervals}|${key.rhythm}`;
      const transposedKey = `transposed:${key.intervals}`;
      if (!seen.has(exactKey)) seen.set(exactKey, []);
      seen.get(exactKey)!.push(start);
      if (!seen.has(transposedKey)) seen.set(transposedKey, []);
      seen.get(transposedKey)!.push(start);
    }

    for (const [key, indexes] of seen.entries()) {
      if (indexes.length < 2) continue;
      const variationType = key.startsWith("exact:") ? "exact" : "transposed";
      motifs.push({
        id: `motif-${motifs.length + 1}`,
        pattern: key.split(":")[1],
        noteIndexes: indexes,
        occurrences: indexes.length,
        variationType,
        confidence: Number((0.45 + indexes.length * 0.15).toFixed(3)),
      });
      if (variationType === "transposed") transformations.push(`Transposed sequence at notes ${indexes.join(", ")}`);
      sequences.push(`Sequence length ${length} repeated ${indexes.length} times`);
    }
  }

  return {
    motifs: motifs.sort((left, right) => right.occurrences - left.occurrences).slice(0, 8),
    sequences: Array.from(new Set(sequences)).slice(0, 6),
    transformations: Array.from(new Set(transformations)).slice(0, 6),
  };
}