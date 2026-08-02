import type { MidiNoteEvent, MidiOptions, MidiTrackDefinition } from "./types.js";

function hashSeed(seed: number) {
  let value = seed >>> 0;
  if (value === 0) value = 0x9e3779b9;
  return value;
}

function createRandom(seed: number) {
  let state = hashSeed(seed);
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 0xffffffff);
  };
}

function grooveGrid(role: MidiTrackDefinition["role"], groove: MidiOptions["groove"]) {
  if (role === "drums") return groove === "tight" ? 0.25 : 0.5;
  return groove === "laid_back" ? 0.5 : 0.25;
}

function grooveOffset(groove: MidiOptions["groove"]) {
  switch (groove) {
    case "pushed":
      return -0.015;
    case "laid_back":
      return 0.02;
    case "syncopated":
      return 0.01;
    default:
      return 0;
  }
}

function clampVelocity(value: number) {
  return Math.max(1, Math.min(127, Math.round(value)));
}

function humanizeNote(note: MidiNoteEvent, track: MidiTrackDefinition, options: MidiOptions, random: () => number): MidiNoteEvent {
  const grid = grooveGrid(track.role, options.groove);
  const grooveBias = grooveOffset(options.groove);
  const nearest = Math.round(note.startBeat / grid) * grid;
  let startBeat = note.startBeat + ((nearest - note.startBeat) * options.quantizeStrength);
  const subdivision = Math.round(startBeat / grid);
  if (options.swing > 0 && subdivision % 2 === 1) {
    startBeat += grid * options.swing * (track.isDrum ? 0.75 : 0.45);
  }
  const varianceMultiplier = Math.abs(Math.round(note.startBeat) - note.startBeat) < 0.0001 ? 0.35 : 1;
  const randomOffset = ((random() * 2) - 1) * options.timingVariationBeats * varianceMultiplier;
  startBeat = Math.max(0, Number((startBeat + grooveBias + randomOffset).toFixed(4)));

  const accent = Math.abs(startBeat % 1) < 0.0001 ? 6 : 0;
  const roleBias = track.role === "bassline" ? 4 : track.role === "drums" ? 5 : 0;
  const velocityOffset = ((random() * 2) - 1) * options.velocityVariation;
  const velocity = clampVelocity(note.velocity + accent + roleBias + velocityOffset);

  return {
    ...note,
    startBeat,
    velocity,
  };
}

export function humanizeTrack(track: MidiTrackDefinition, options: MidiOptions, seed: number) {
  const random = createRandom(seed + track.channel + track.notes.length);
  return {
    ...track,
    notes: track.notes
      .map((note) => humanizeNote(note, track, options, random))
      .sort((left, right) => left.startBeat - right.startBeat || left.pitch - right.pitch),
  };
}