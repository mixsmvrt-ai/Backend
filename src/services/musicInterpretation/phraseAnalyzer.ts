import type { DetectedNote, PitchAnalysisResult } from "../pitch/types.js";
import type { MusicalPhrase, PhraseAnalysisResult } from "./types.js";

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function contourFor(notes: DetectedNote[]) {
  if (notes.length <= 2) return "flat" as const;
  const deltas = notes.slice(1).map((note, index) => note.midi - notes[index].midi);
  const ascending = deltas.filter((value) => value > 0).length;
  const descending = deltas.filter((value) => value < 0).length;
  if (ascending === 0 && descending === 0) return "flat" as const;
  if (ascending > 0 && descending > 0) {
    const peakIndex = notes.findIndex((note) => note.midi === Math.max(...notes.map((entry) => entry.midi)));
    return peakIndex > 0 && peakIndex < notes.length - 1 ? "arch" as const : "mixed" as const;
  }
  return ascending > descending ? "ascending" as const : "descending" as const;
}

function cadenceFor(notes: DetectedNote[], tonicPitchClass: number | null) {
  if (notes.length === 0 || tonicPitchClass === null) return "neutral" as const;
  const lastPitchClass = notes[notes.length - 1].midi % 12;
  if (lastPitchClass === tonicPitchClass) return "resolved" as const;
  if (Math.abs(lastPitchClass - tonicPitchClass) === 1 || Math.abs(lastPitchClass - tonicPitchClass) === 11) return "open" as const;
  return "neutral" as const;
}

function repeatedIdeaPatterns(phrases: MusicalPhrase[], notesByPhrase: DetectedNote[][]) {
  const repeated: string[] = [];
  for (let index = 0; index < notesByPhrase.length; index += 1) {
    for (let compare = index + 1; compare < notesByPhrase.length; compare += 1) {
      const first = notesByPhrase[index].map((note) => note.midi - notesByPhrase[index][0].midi).join(",");
      const second = notesByPhrase[compare].map((note) => note.midi - notesByPhrase[compare][0].midi).join(",");
      if (first && first === second) {
        phrases[index].repeatedIdea = true;
        phrases[compare].repeatedIdea = true;
        repeated.push(`${phrases[index].id}:${phrases[compare].id}`);
      }
    }
  }
  return repeated;
}

export function analyzePhrases(analysis: PitchAnalysisResult): PhraseAnalysisResult {
  const boundaries = new Set<number>(analysis.timing.phraseBoundaries.map((value) => Number(value.toFixed(3))));
  const notes = analysis.detectedNotes;
  const tonicPitchClass = analysis.estimatedKey.key
    ? ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].indexOf(analysis.estimatedKey.key)
    : null;

  const phrases: MusicalPhrase[] = [];
  const notesByPhrase: DetectedNote[][] = [];
  let current: DetectedNote[] = [];

  for (const note of notes) {
    if (current.length > 0 && boundaries.has(Number(note.startTime.toFixed(3)))) {
      notesByPhrase.push(current);
      current = [];
    }
    current.push(note);
  }
  if (current.length > 0) notesByPhrase.push(current);
  if (notesByPhrase.length === 0 && notes.length > 0) notesByPhrase.push(notes);

  notesByPhrase.forEach((phraseNotes, index) => {
    const startTime = phraseNotes[0].startTime;
    const endTime = phraseNotes[phraseNotes.length - 1].endTime;
    const averagePhraseInterval = average(phraseNotes.slice(1).map((note, phraseIndex) => Math.abs(note.midi - phraseNotes[phraseIndex].midi)));
    const role = index === 0 ? "opening" : index === notesByPhrase.length - 1 ? "ending" : index % 2 === 1 ? "answer" : "development";
    phrases.push({
      id: `phrase-${index + 1}`,
      startTime: Number(startTime.toFixed(3)),
      endTime: Number(endTime.toFixed(3)),
      duration: Number((endTime - startTime).toFixed(3)),
      noteCount: phraseNotes.length,
      contour: contourFor(phraseNotes),
      role,
      cadence: cadenceFor(phraseNotes, tonicPitchClass),
      averageInterval: Number(averagePhraseInterval.toFixed(3)),
      repeatedIdea: false,
    });
  });

  const repeatedIdeas = repeatedIdeaPatterns(phrases, notesByPhrase);
  const questionAnswerPairs = phrases.slice(0, -1).flatMap((phrase, index) => {
    const next = phrases[index + 1];
    if (phrase.role === "opening" || phrase.cadence === "open") {
      return [{ questionPhraseId: phrase.id, answerPhraseId: next.id, confidence: next.cadence === "resolved" ? 0.78 : 0.56 }];
    }
    return [];
  });

  return {
    phrases,
    phraseBoundaries: phrases.map((phrase) => phrase.startTime),
    repeatedIdeas,
    questionAnswerPairs,
    openingPhraseId: phrases[0]?.id ?? null,
    endingPhraseId: phrases[phrases.length - 1]?.id ?? null,
  };
}