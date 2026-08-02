import type { AiComposition } from "../ai/types.js";
import type { MidiArrangementSection, MidiNoteEvent } from "./types.js";

const SECTION_INTENSITY: Record<string, number> = {
  intro: 0.65,
  verse: 0.85,
  pre: 0.92,
  prechorus: 0.92,
  chorus: 1.1,
  hook: 1.15,
  bridge: 0.9,
  breakdown: 0.75,
  outro: 0.7,
};

function normalizeSectionName(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z]/g, "");
}

export function buildSections(composition: AiComposition): MidiArrangementSection[] {
  let currentBar = 1;
  const beatsPerBar = composition.timeSignature[0];
  const source = composition.arrangement.length > 0
    ? composition.arrangement
    : [
      { name: "Intro", bars: 4, elements: ["melody"] },
      { name: "Verse", bars: 8, elements: ["melody", "bassline"] },
      { name: "Hook", bars: 8, elements: ["melody", "chords", "bassline"] },
      { name: "Outro", bars: 4, elements: ["melody"] },
    ];

  return source.map((section) => {
    const normalized = normalizeSectionName(section.name);
    const startBar = currentBar;
    const startBeat = (startBar - 1) * beatsPerBar;
    currentBar += section.bars;
    return {
      name: section.name,
      bars: section.bars,
      startBar,
      startBeat,
      endBeat: startBeat + (section.bars * beatsPerBar),
      intensity: SECTION_INTENSITY[normalized] ?? (normalized.includes("hook") ? 1.15 : 1),
    };
  });
}

function withinSection(note: MidiNoteEvent, section: MidiArrangementSection) {
  return note.startBeat >= section.startBeat && note.startBeat < section.endBeat;
}

function normalizedMotif(notes: MidiNoteEvent[]) {
  if (notes.length === 0) return [];
  const firstBeat = notes[0]!.startBeat;
  return notes.map((note) => ({
    ...note,
    startBeat: note.startBeat - firstBeat,
  }));
}

function sectionMotif(source: MidiNoteEvent[], sectionLengthBeats: number) {
  const motif = normalizedMotif(source.slice(0, Math.min(source.length, 16)));
  if (motif.length === 0) return [];
  const motifLength = Math.max(...motif.map((note) => note.startBeat + note.durationBeats), 1);
  const clones: MidiNoteEvent[] = [];
  for (let cursor = 0; cursor < sectionLengthBeats; cursor += motifLength) {
    for (const note of motif) {
      if ((cursor + note.startBeat) >= sectionLengthBeats) continue;
      clones.push({
        ...note,
        startBeat: cursor + note.startBeat,
      });
    }
  }
  return clones;
}

export function arrangeNotes(source: MidiNoteEvent[], sections: MidiArrangementSection[], fallbackFactory?: (section: MidiArrangementSection) => MidiNoteEvent[]) {
  const arranged: MidiNoteEvent[] = [];
  const motifSource = source.length > 0 ? normalizedMotif(source) : [];
  for (const section of sections) {
    const sectionNotes = source.filter((note) => withinSection(note, section));
    const produced = sectionNotes.length > 0
      ? sectionNotes.map((note) => ({
        ...note,
        velocity: Math.max(1, Math.min(127, Math.round(note.velocity * section.intensity))),
      }))
      : fallbackFactory?.(section)
        ?? sectionMotif(motifSource, section.endBeat - section.startBeat).map((note) => ({
          ...note,
          startBeat: section.startBeat + note.startBeat,
          velocity: Math.max(1, Math.min(127, Math.round(note.velocity * section.intensity))),
        }));
    arranged.push(...produced);
  }
  return arranged.sort((left, right) => left.startBeat - right.startBeat || left.pitch - right.pitch);
}