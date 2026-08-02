import { writeMidi, writeMultiTrackMidi } from "../midi/midi-writer.js";
import { buildZipArchive, humanizeTrack, midiOptionsSchema, type MidiTrackDefinition } from "./midiGeneration/index.js";
import type { CompactMusicPlan } from "./aiOrchestrator/index.js";

const PROGRAMS: Record<string, number> = {
  melody: 81,
  bassline: 38,
  chords: 89,
  counter_melody: 82,
  drums: 0,
  lead: 80,
  pluck: 13,
  strings: 49,
  pads: 88,
  brass: 61,
  arpeggio: 81,
  guitar: 25,
  piano: 1,
  choir: 53,
};

function normalizeRole(value: string): MidiTrackDefinition["role"] {
  const text = value.toLowerCase();
  if (text.includes("drum")) return "drums";
  if (text.includes("bass")) return "bassline";
  if (text.includes("chord") || text.includes("pad") || text.includes("string") || text.includes("brass") || text.includes("guitar") || text.includes("choir") || text.includes("harmony")) return "chords";
  if (text.includes("counter")) return "counter_melody";
  return "melody";
}

function programFor(track: { instrument: string; role: string }) {
  const role = track.role.toLowerCase();
  const instrument = track.instrument.toLowerCase();
  if (PROGRAMS[role] !== undefined) return PROGRAMS[role];
  if (instrument.includes("bass") || instrument.includes("808")) return PROGRAMS.bassline;
  if (instrument.includes("pad")) return PROGRAMS.pads;
  if (instrument.includes("string")) return PROGRAMS.strings;
  if (instrument.includes("piano") || instrument.includes("keys")) return PROGRAMS.piano;
  if (instrument.includes("guitar")) return PROGRAMS.guitar;
  if (instrument.includes("brass")) return PROGRAMS.brass;
  if (instrument.includes("choir")) return PROGRAMS.choir;
  return PROGRAMS.melody;
}

function toTrackDefinitions(plan: CompactMusicPlan) {
  const baseOptions = midiOptionsSchema.parse({ exportMode: "all" });
  return plan.tracks.map((track, index) => {
    const role = normalizeRole(track.role);
    const definition: MidiTrackDefinition = {
      role,
      name: track.name,
      channel: role === "drums" ? 9 : Math.min(index, 8),
      program: programFor(track),
      isDrum: role === "drums",
      notes: track.notes.map((note) => ({ pitch: note.p, startBeat: note.s, durationBeats: note.d, velocity: note.v })),
    };
    return humanizeTrack(definition, baseOptions, plan.tempo + index * 97 + plan.bars);
  });
}

function mergedTrack(plan: CompactMusicPlan, tracks: MidiTrackDefinition[]): MidiTrackDefinition {
  return {
    role: "melody",
    name: plan.tracks[0]?.name ?? "MidiFlow Idea",
    channel: 0,
    program: 81,
    isDrum: false,
    notes: tracks.flatMap((track) => track.notes).sort((left, right) => left.startBeat - right.startBeat || left.pitch - right.pitch),
  };
}

export function renderCompactPlan(plan: CompactMusicPlan, filePrefix: string) {
  const tracks = toTrackDefinitions(plan);
  const merged = mergedTrack(plan, tracks);
  const single = {
    kind: "single" as const,
    fileName: `${filePrefix}.mid`,
    mimeType: "audio/midi",
    buffer: writeMidi({ tempo: plan.tempo, key: plan.key, scale: plan.scale, timeSignature: plan.timeSignature, trackName: merged.name, notes: merged.notes, chordProgression: [], structure: [{ name: "Main", bars: plan.bars }], pluginRecommendations: [] }),
  };
  const multi = {
    kind: "multi" as const,
    fileName: `${filePrefix}-multitrack.mid`,
    mimeType: "audio/midi",
    buffer: writeMultiTrackMidi({ trackName: filePrefix, tempo: plan.tempo, timeSignature: plan.timeSignature, tracks }),
  };
  const perTrack = tracks.map((track, index) => ({
    fileName: `${filePrefix}-${index + 1}-${track.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.mid`,
    mimeType: "audio/midi",
    label: track.name,
    role: track.role,
    buffer: writeMidi({ tempo: plan.tempo, key: plan.key, scale: plan.scale, timeSignature: plan.timeSignature, trackName: track.name, notes: track.notes, chordProgression: [], structure: [{ name: track.name, bars: plan.bars }], pluginRecommendations: [] }),
  }));
  const packageExport = {
    kind: "package" as const,
    fileName: `${filePrefix}-exports.zip`,
    mimeType: "application/zip",
    buffer: buildZipArchive([
      single,
      multi,
      ...perTrack.map((item) => ({ fileName: item.fileName, buffer: item.buffer })),
      { fileName: "Metadata.json", buffer: Buffer.from(JSON.stringify({ tempo: plan.tempo, key: plan.key, scale: plan.scale, bars: plan.bars, tracks: plan.tracks.map((track) => ({ name: track.name, instrument: track.instrument, role: track.role })) }, null, 2), "utf8") },
    ]),
  };
  return { tracks, single, multi, perTrack, packageExport };
}