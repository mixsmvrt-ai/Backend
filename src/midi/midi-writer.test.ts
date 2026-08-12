import { Midi } from "@tonejs/midi";
import { describe, expect, it } from "vitest";
import type { StructuredMusic } from "../domain/music.js";
import { writeMidi } from "./midi-writer.js";

describe("writeMidi", () => {
  it("preserves separate guitar harmony and melody tracks", () => {
    const music: StructuredMusic = {
      tempo: 100,
      key: "F Minor",
      scale: "Natural Minor",
      timeSignature: [4, 4],
      trackName: "Kraff Spanish Guitar",
      notes: [{ pitch: 69, startBeat: 0, durationBeats: 1, velocity: 90 }],
      chordProgression: ["Fm7"],
      structure: [{ name: "Hook", bars: 8 }],
      pluginRecommendations: [],
      tracks: [
        { role: "guitar", name: "Guitar Harmony", channel: 0, program: 25, isDrum: false, notes: [{ pitch: 53, startBeat: 0, durationBeats: 0.5, velocity: 82 }] },
        { role: "melody", name: "Main Melody", channel: 1, program: 81, isDrum: false, notes: [{ pitch: 69, startBeat: 0.5, durationBeats: 1, velocity: 94 }] },
      ],
    };

    const bytes = writeMidi(music);
    const midi = new Midi(bytes);

    expect(bytes.readUInt16BE(8)).toBe(1);
    expect(midi.tracks).toHaveLength(2);
    expect(midi.tracks.map((track) => track.instrument.number)).toEqual([25, 81]);
    expect(midi.tracks.map((track) => track.notes.length)).toEqual([1, 1]);
  });
});
