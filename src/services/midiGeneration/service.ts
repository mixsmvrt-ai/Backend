import type { OrchestrationInput, StructuredMusic } from "../../domain/music.js";
import { writeMidi, writeMultiTrackMidi } from "../../midi/midi-writer.js";
import type { AiComposition } from "../ai/types.js";
import { buildZipArchive } from "./archive.js";
import { buildSections, arrangeNotes } from "./arrangement.js";
import { humanizeTrack } from "./humanize.js";
import { midiOptionsSchema, type LegacyNoteEvent, type MidiGenerationBundle, type MidiNoteEvent, type MidiOptions, type MidiTrackDefinition } from "./types.js";

const PITCH_CLASS_MAP: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

const TRACK_PROGRAMS = {
  melody: 81,
  chords: 89,
  bassline: 38,
  drums: 0,
  counter_melody: 82,
} as const;

const MAX_LEGACY_NOTE_DURATION = 16;

function clampMidiPitch(value: number) {
  return Math.max(0, Math.min(127, Math.round(value)));
}

function normalizeKeyTonic(key: string) {
  const token = key.trim().split(/\s+/)[0] ?? "C";
  return PITCH_CLASS_MAP[token] ?? 0;
}

function isMinorScale(scale: string, key: string) {
  return /minor|aeolian|dorian|phrygian|locrian/i.test(scale) || /minor/i.test(key);
}

function romanDegree(romanNumeral: string) {
  const normalized = romanNumeral.replace(/[^ivIV#b]/g, "");
  const accidental = normalized.startsWith("b") ? -1 : normalized.startsWith("#") ? 1 : 0;
  const numeral = normalized.replace(/^[b#]+/, "").toUpperCase();
  const degrees: Record<string, number> = { I: 0, II: 1, III: 2, IV: 3, V: 4, VI: 5, VII: 6 };
  return { degree: degrees[numeral] ?? 0, accidental, normalized };
}

function chordIntervals(symbol: string, romanNumeral: string) {
  if (/dim|o/i.test(symbol) || /vii/i.test(romanNumeral)) return [0, 3, 6];
  if (/aug|\+/i.test(symbol)) return [0, 4, 8];
  const minor = /m(?!aj)/i.test(symbol) || /^[b#]*[iv]+$/.test(romanNumeral);
  const seventh = /7/.test(symbol);
  const base = minor ? [0, 3, 7] : [0, 4, 7];
  return seventh ? [...base, minor ? 10 : 11] : base;
}

function toMidiNotes(notes: Array<{ pitch: number; startBeat: number; durationBeats: number; velocity: number }>): MidiNoteEvent[] {
  return notes.map((note) => ({
    pitch: clampMidiPitch(note.pitch),
    startBeat: Math.max(0, Number(note.startBeat.toFixed(4))),
    durationBeats: Math.max(0.125, Number(note.durationBeats.toFixed(4))),
    velocity: Math.max(1, Math.min(127, Math.round(note.velocity))),
  }));
}

function chunkLegacyNotes(notes: MidiNoteEvent[]): LegacyNoteEvent[] {
  return notes.flatMap((note) => {
    const chunks: LegacyNoteEvent[] = [];
    let remaining = Math.max(0.25, note.durationBeats);
    let startBeat = Math.max(0, note.startBeat);
    while (remaining > 0) {
      const durationBeats = Math.min(MAX_LEGACY_NOTE_DURATION, remaining);
      chunks.push({
        pitch: clampMidiPitch(note.pitch),
        startBeat,
        durationBeats,
        velocity: Math.max(1, Math.min(127, Math.round(note.velocity))),
      });
      startBeat += durationBeats;
      remaining -= durationBeats;
    }
    return chunks;
  }).slice(0, 2048);
}

function chordRhythm(groove: MidiOptions["groove"], complexity: OrchestrationInput["complexity"]) {
  if (groove === "syncopated" || groove === "pushed") return [0, 0.75, 1.5, 2.75, 3.5].map((startBeat) => ({ startBeat, durationBeats: startBeat === 2.75 ? 0.75 : 0.5 }));
  if (groove === "swing") return [{ startBeat: 0, durationBeats: 1.25 }, { startBeat: 1.5, durationBeats: 0.75 }, { startBeat: 3, durationBeats: 0.75 }];
  if (complexity === "high") return [{ startBeat: 0, durationBeats: 1 }, { startBeat: 1.75, durationBeats: 0.5 }, { startBeat: 3, durationBeats: 0.75 }];
  return [{ startBeat: 0, durationBeats: 4 }];
}

function chordTrackFromComposition(composition: AiComposition, options: MidiOptions, complexity: OrchestrationInput["complexity"]) {
  const tonic = normalizeKeyTonic(composition.key);
  const scaleSteps = isMinorScale(composition.scale, composition.key) ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  const beatsPerBar = composition.timeSignature[0];
  const notes: MidiNoteEvent[] = [];
  const pattern = chordRhythm(options.groove, complexity);
  for (const chord of composition.chordProgression) {
    const degreeInfo = romanDegree(chord.romanNumeral);
    const rootPitchClass = (tonic + scaleSteps[degreeInfo.degree] + degreeInfo.accidental + 12) % 12;
    const rootPitch = 55 + rootPitchClass;
    const startBeat = (Math.max(1, chord.startBar) - 1) * beatsPerBar;
    const chordBars = Math.max(1, chord.bars);
    const intervals = chordIntervals(chord.symbol, chord.romanNumeral);
    for (let bar = 0; bar < chordBars; bar += 1) {
      const barStart = startBeat + (bar * beatsPerBar);
      for (const hit of pattern) {
        if (hit.startBeat >= beatsPerBar) continue;
        for (const interval of intervals) {
          notes.push({
            pitch: rootPitch + interval,
            startBeat: barStart + hit.startBeat,
            durationBeats: Math.min(hit.durationBeats, beatsPerBar - hit.startBeat),
            velocity: hit.startBeat === 0 ? 78 : 68,
          });
        }
      }
    }
  }
  return toMidiNotes(notes);
}

function basslineFromChords(composition: AiComposition) {
  const tonic = normalizeKeyTonic(composition.key);
  const scaleSteps = isMinorScale(composition.scale, composition.key) ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  const beatsPerBar = composition.timeSignature[0];
  return toMidiNotes(composition.chordProgression.flatMap((chord) => {
    const degreeInfo = romanDegree(chord.romanNumeral);
    const rootPitchClass = (tonic + scaleSteps[degreeInfo.degree] + degreeInfo.accidental + 12) % 12;
    const rootPitch = 36 + rootPitchClass;
    const startBeat = (Math.max(1, chord.startBar) - 1) * beatsPerBar;
    return Array.from({ length: Math.max(1, chord.bars) }, (_, index) => ({
      pitch: rootPitch,
      startBeat: startBeat + (index * beatsPerBar),
      durationBeats: Math.max(1, beatsPerBar / 2),
      velocity: 84,
    }));
  }));
}

function counterMelodyFromMelody(melody: MidiNoteEvent[]) {
  return toMidiNotes(melody.filter((_, index) => index % 2 === 0).map((note) => ({
    ...note,
    pitch: note.pitch + 12,
    startBeat: note.startBeat + 0.5,
    durationBeats: Math.max(0.25, note.durationBeats * 0.75),
    velocity: Math.max(1, note.velocity - 8),
  })));
}

function drumPattern(startBeat: number, beatsPerBar: number, intensity: number, sectionName: string) {
  const pattern: MidiNoteEvent[] = [];
  const dense = /hook|chorus/i.test(sectionName) || intensity > 1;
  const sparse = /intro|outro|bridge/i.test(sectionName) && intensity < 0.95;
  pattern.push({ pitch: 36, startBeat, durationBeats: 0.25, velocity: 100 });
  pattern.push({ pitch: 38, startBeat: startBeat + Math.max(1, beatsPerBar / 2), durationBeats: 0.25, velocity: 96 });
  if (beatsPerBar >= 4) {
    pattern.push({ pitch: 36, startBeat: startBeat + 2, durationBeats: 0.25, velocity: 94 });
    pattern.push({ pitch: 38, startBeat: startBeat + 3, durationBeats: 0.25, velocity: 94 });
  }
  const hatStep = dense ? 0.5 : 1;
  for (let cursor = 0; cursor < beatsPerBar; cursor += hatStep) {
    pattern.push({ pitch: dense ? 42 : 46, startBeat: startBeat + cursor, durationBeats: 0.2, velocity: sparse ? 62 : 74 });
  }
  if (dense) {
    pattern.push({ pitch: 39, startBeat: startBeat + beatsPerBar - 0.5, durationBeats: 0.2, velocity: 82 });
  }
  return pattern;
}

function drumsFromSections(sections: ReturnType<typeof buildSections>, beatsPerBar: number) {
  return toMidiNotes(sections.flatMap((section) => {
    const notes: MidiNoteEvent[] = [];
    for (let bar = 0; bar < section.bars; bar += 1) {
      notes.push(...drumPattern(section.startBeat + (bar * beatsPerBar), beatsPerBar, section.intensity, section.name));
    }
    return notes;
  }));
}

function resolveOptions(input: OrchestrationInput): MidiOptions {
  const defaults = midiOptionsSchema.parse(input.midiOptions ?? {});
  const prompt = input.prompt.toLowerCase();
  const inferredGroove: MidiOptions["groove"] | undefined = /syncop|groove|groovy|bounce|bouncy|off[- ]?beat|dancehall|afro|skank|staccato|rhythmic/.test(prompt)
    ? "syncopated"
    : /swing|shuffle|triplet/.test(prompt)
      ? "swing"
      : /pushed|urgent|driving|energetic/.test(prompt)
        ? "pushed"
        : undefined;
  return {
    ...defaults,
    timingVariationBeats: input.midiOptions?.timingVariationBeats ?? Number((0.01 + (input.variationAmount * 0.03)).toFixed(4)),
    velocityVariation: input.midiOptions?.velocityVariation ?? Math.round(6 + (input.variationAmount * 14)),
    swing: input.midiOptions?.swing ?? (input.kind === "drums" ? 0.12 : 0.06),
    quantizeStrength: input.midiOptions?.quantizeStrength ?? (input.complexity === "high" ? 0.58 : input.complexity === "low" ? 0.82 : 0.7),
    groove: input.midiOptions?.groove ?? (input.kind === "drums" ? "syncopated" : inferredGroove ?? (input.complexity === "low" ? "tight" : "laid_back")),
  };
}

function selectLegacyNotes(input: OrchestrationInput, tracks: MidiTrackDefinition[]) {
  const melody = tracks.find((track) => track.role === "melody")?.notes ?? [];
  const bassline = tracks.find((track) => track.role === "bassline")?.notes ?? [];
  const counterMelody = tracks.find((track) => track.role === "counter_melody")?.notes ?? [];
  const chords = tracks.find((track) => track.role === "chords")?.notes ?? [];
  const drums = tracks.find((track) => track.role === "drums")?.notes ?? [];
  switch (input.kind) {
    case "bassline":
      return chunkLegacyNotes(bassline.length ? bassline : melody);
    case "counter_melody":
      return chunkLegacyNotes(counterMelody.length ? counterMelody : melody);
    case "chords":
      return chunkLegacyNotes(chords.length ? chords : melody);
    case "drums":
      return chunkLegacyNotes(drums.length ? drums : melody);
    case "full_composition":
      return chunkLegacyNotes([...melody, ...bassline, ...counterMelody, ...chords, ...drums].sort((left, right) => left.startBeat - right.startBeat || left.pitch - right.pitch));
    case "melody":
    default:
      return chunkLegacyNotes(melody);
  }
}

function pluginRecommendations(input: OrchestrationInput, composition: AiComposition) {
  if (!input.pluginSuggestions) return [];
  return composition.pluginCategories.slice(0, 8).map((category, index) => ({
    instrumentType: input.kind.replace(/_/g, " "),
    presetType: category,
    genreMatch: composition.genre,
    moodMatch: composition.mood,
    alternative: composition.productionNotes[index] ?? composition.variationSuggestions[index] ?? category,
  }));
}

export class MidiGenerationService {
  build(input: OrchestrationInput, composition: AiComposition, generationId: string): MidiGenerationBundle {
    const options = resolveOptions(input);
    const seed = input.randomSeed ?? generationId.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0);
    const sections = buildSections(composition);
    const beatsPerBar = composition.timeSignature[0];

    const melodyNotes = arrangeNotes(toMidiNotes(composition.melody), sections);
    const chordNotes = arrangeNotes(chordTrackFromComposition(composition, options, input.complexity), sections);
    const basslineNotes = arrangeNotes(toMidiNotes(composition.bassline), sections, (section) => basslineFromChords(composition).filter((note) => note.startBeat >= section.startBeat && note.startBeat < section.endBeat));
    const counterMelodyNotes = arrangeNotes(toMidiNotes(composition.counterMelody), sections, (section) => counterMelodyFromMelody(melodyNotes).filter((note) => note.startBeat >= section.startBeat && note.startBeat < section.endBeat));
    const drumNotes = arrangeNotes(drumsFromSections(sections, beatsPerBar), sections);

    const trackDefinitions: MidiTrackDefinition[] = [
      { role: "melody", name: "Melody", channel: 0, program: TRACK_PROGRAMS.melody, isDrum: false, notes: melodyNotes },
      { role: "chords", name: "Chords", channel: 1, program: TRACK_PROGRAMS.chords, isDrum: false, notes: chordNotes },
      { role: "bassline", name: "Bassline", channel: 2, program: TRACK_PROGRAMS.bassline, isDrum: false, notes: basslineNotes },
      { role: "counter_melody", name: "Counter Melody", channel: 3, program: TRACK_PROGRAMS.counter_melody, isDrum: false, notes: counterMelodyNotes },
      { role: "drums", name: "Drums", channel: 9, program: TRACK_PROGRAMS.drums, isDrum: true, notes: drumNotes },
    ];
    const baseTracks = trackDefinitions.map((track, index) => humanizeTrack(track, {
      ...options,
      timingVariationBeats: track.isDrum ? Math.min(options.timingVariationBeats, 0.015) : options.timingVariationBeats,
      quantizeStrength: track.isDrum ? Math.max(options.quantizeStrength, 0.8) : options.quantizeStrength,
    }, seed + (index * 97)));

    const legacyMusic: StructuredMusic = {
      tempo: composition.tempo,
      key: composition.key,
      scale: composition.scale,
      timeSignature: composition.timeSignature,
      trackName: composition.trackName,
      notes: selectLegacyNotes(input, baseTracks),
      chordProgression: composition.chordProgression.map((entry) => entry.symbol).slice(0, 32),
      structure: sections.map((section) => ({ name: section.name, bars: section.bars })).slice(0, 16),
      pluginRecommendations: pluginRecommendations(input, composition),
    };

    const singleTrack = {
      kind: "single" as const,
      fileName: `${input.kind}-${generationId}.mid`,
      mimeType: "audio/midi",
      buffer: writeMidi(legacyMusic),
    };
    const multiTrack = {
      kind: "multi" as const,
      fileName: `${input.kind}-${generationId}-multitrack.mid`,
      mimeType: "audio/midi",
      buffer: writeMultiTrackMidi({
        trackName: composition.trackName,
        tempo: composition.tempo,
        timeSignature: composition.timeSignature,
        tracks: baseTracks,
      }),
    };
    const packageExport = {
      kind: "package" as const,
      fileName: `${input.kind}-${generationId}-exports.zip`,
      mimeType: "application/zip",
      buffer: buildZipArchive([singleTrack, multiTrack]),
    };

    const exports = options.exportMode === "single"
      ? [singleTrack]
      : options.exportMode === "multi"
        ? [multiTrack]
        : options.exportMode === "package"
          ? [packageExport]
          : [singleTrack, multiTrack, packageExport];

    return {
      legacyMusic,
      tracks: baseTracks,
      sections,
      exports,
    };
  }
}

export const midiGenerationService = new MidiGenerationService();