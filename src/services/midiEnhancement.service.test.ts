import { describe, expect, it } from "vitest";
import { writeMidi } from "../midi/midi-writer.js";
import { enhanceMidiBuffer } from "./midiEnhancement.service.js";

const source = writeMidi({
  tempo: 100,
  key: "C",
  scale: "Minor",
  timeSignature: [4, 4],
  trackName: "Test",
  notes: [
    { pitch: 60, startBeat: 0, durationBeats: 1, velocity: 70 },
    { pitch: 64, startBeat: 2, durationBeats: 1, velocity: 70 },
  ],
  chordProgression: [],
  structure: [{ name: "Main", bars: 8 }],
  pluginRecommendations: [],
});

describe("MIDI enhancement", () => {
  it("keeps a valid MIDI buffer and strengthens existing notes", async () => {
    const { Midi } = await import("@tonejs/midi");
    const before = new Midi(source);
    const after = new Midi(enhanceMidiBuffer(source));
    const beforeNotes = before.tracks.flatMap((track) => track.notes);
    const afterNotes = after.tracks.flatMap((track) => track.notes);

    expect(after.header.tempos[0]?.bpm).toBeCloseTo(before.header.tempos[0]?.bpm ?? 100, 0);
    expect(afterNotes).toHaveLength(beforeNotes.length);
    expect(afterNotes[0]?.velocity).toBeGreaterThan(beforeNotes[0]?.velocity ?? 0);
  });
});
