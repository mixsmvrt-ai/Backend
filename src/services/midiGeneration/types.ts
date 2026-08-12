import { z } from "zod";
import type { StructuredMusic } from "../../domain/music.js";

export const midiGrooveSchema = z.enum(["tight", "pushed", "laid_back", "swing", "syncopated"]);

export const midiOptionsSchema = z.object({
  timingVariationBeats: z.number().min(0).max(0.25).default(0.02),
  velocityVariation: z.number().int().min(0).max(32).default(10),
  swing: z.number().min(0).max(0.75).default(0),
  quantizeStrength: z.number().min(0).max(1).default(0.7),
  groove: midiGrooveSchema.default("tight"),
  exportMode: z.enum(["single", "multi", "package", "all"]).default("all"),
});

export type MidiOptionsInput = z.input<typeof midiOptionsSchema>;
export type MidiOptions = z.infer<typeof midiOptionsSchema>;
export type LegacyNoteEvent = StructuredMusic["notes"][number];
export type MidiTrackRole = "melody" | "guitar" | "chords" | "bassline" | "drums" | "counter_melody";
export type MidiExportKind = "single" | "multi" | "package";

export interface MidiNoteEvent {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
}

export interface MidiTrackDefinition {
  role: MidiTrackRole;
  name: string;
  channel: number;
  program: number;
  isDrum: boolean;
  notes: MidiNoteEvent[];
}

export interface MidiArrangementSection {
  name: string;
  bars: number;
  startBar: number;
  startBeat: number;
  endBeat: number;
  intensity: number;
}

export interface MultiTrackMidiSong {
  trackName: string;
  tempo: number;
  timeSignature: [number, number];
  tracks: MidiTrackDefinition[];
}

export interface MidiExportArtifact {
  kind: MidiExportKind;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

export interface MidiGenerationBundle {
  legacyMusic: StructuredMusic;
  tracks: MidiTrackDefinition[];
  sections: MidiArrangementSection[];
  exports: MidiExportArtifact[];
}