import { aiCompositionSchema } from "./types.js";
import { jsonValidator } from "./jsonValidator.js";
import { AiOrchestrationError, type AiComposition } from "./types.js";
import type { StructuredMusic } from "../../domain/music.js";

export class ResponseValidator {
  validate(content: string): { response: AiComposition; repaired: boolean } {
    const { value, repaired } = jsonValidator.parse(content);
    const parsed = aiCompositionSchema.safeParse(value);
    if (!parsed.success) {
      throw new AiOrchestrationError(`AI response failed schema validation: ${parsed.error.issues[0]?.message ?? "invalid output"}`, "AI_SCHEMA_VALIDATION_FAILED", 502, true);
    }
    return { response: parsed.data, repaired };
  }
}

export function validateCompositionQuality(response: AiComposition, expectedBars: number, kind: string) {
  if (kind === "drums") return response;
  const beatsPerBar = response.timeSignature[0];
  const targetBeat = expectedBars * beatsPerBar;
  const melodyEnd = Math.max(...response.melody.map((note) => note.startBeat + note.durationBeats));
  const melodyBars = new Set(response.melody.map((note) => Math.floor(note.startBeat / beatsPerBar))).size;
  const requiredBars = Math.max(4, Math.ceil(expectedBars * 0.5));
  if (melodyEnd < targetBeat - beatsPerBar || melodyBars < requiredBars || response.melody.length < 8) {
    throw new AiOrchestrationError(`Composition quality check failed: the melody must develop across the full ${expectedBars}-bar form with a complete hook and phrase resolution.`, "AI_MELODY_FORM_INCOMPLETE", 502, true);
  }
  const chordEnd = Math.max(...response.chordProgression.map((chord) => (chord.startBar - 1 + chord.bars) * beatsPerBar));
  if (chordEnd < targetBeat) {
    throw new AiOrchestrationError(`Composition quality check failed: chord movement must cover all ${expectedBars} bars.`, "AI_HARMONY_FORM_INCOMPLETE", 502, true);
  }
  return response;
}

export function validateStructuredMusicQuality(response: StructuredMusic, expectedBars: number, kind: string) {
  if (kind === "drums") return response;
  const beatsPerBar = response.timeSignature[0];
  const targetBeat = expectedBars * beatsPerBar;
  const noteEnd = Math.max(...response.notes.map((note) => note.startBeat + note.durationBeats));
  const activeBars = new Set(response.notes.map((note) => Math.floor(note.startBeat / beatsPerBar))).size;
  if (noteEnd < targetBeat - beatsPerBar || activeBars < Math.max(4, Math.ceil(expectedBars * 0.5)) || response.notes.length < 8) {
    throw new AiOrchestrationError(`Composition quality check failed: notes must develop across the full ${expectedBars}-bar form with a resolved final phrase.`, "AI_NOTE_FORM_INCOMPLETE", 502, true);
  }
  const requiresHarmony = kind === "full_composition" || kind === "chords";
  if ((requiresHarmony && !response.chordProgression.length) || response.structure.reduce((total, section) => total + section.bars, 0) < expectedBars) {
    throw new AiOrchestrationError(`Composition quality check failed: harmony and structure must cover all ${expectedBars} bars.`, "AI_STRUCTURE_INCOMPLETE", 502, true);
  }
  return response;
}

export const responseValidator = new ResponseValidator();