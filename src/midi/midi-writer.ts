import type { StructuredMusic } from "../domain/music.js";
import type { MultiTrackMidiSong, MidiTrackDefinition } from "../services/midiGeneration/types.js";

const text = (value: string) => Buffer.concat([Buffer.from([value.length]), Buffer.from(value, "utf8")]);
const vlq = (value: number) => { const bytes = [value & 0x7f]; while ((value >>= 7)) bytes.unshift((value & 0x7f) | 0x80); return Buffer.from(bytes); };
const event = (delta: number, bytes: number[]) => Buffer.concat([vlq(delta), Buffer.from(bytes)]);
const ticksPerBeat = 480;

function chunk(track: Buffer) {
  return Buffer.concat([
    Buffer.from("MTrk"),
    Buffer.from([(track.length >>> 24) & 255, (track.length >>> 16) & 255, (track.length >>> 8) & 255, track.length & 255]),
    track,
  ]);
}

function tempoTrack(trackName: string, tempoBpm: number, timeSignature: [number, number]) {
  const tempo = Math.round(60000000 / tempoBpm);
  const events = [
    { tick: 0, order: 0, bytes: [0xff, 0x03, ...text(trackName)] },
    { tick: 0, order: 0, bytes: [0xff, 0x51, 0x03, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255] },
    { tick: 0, order: 0, bytes: [0xff, 0x58, 0x04, timeSignature[0], Math.log2(timeSignature[1]), 24, 8] },
  ];
  let previous = 0;
  const content = Buffer.concat([...events.map((item) => {
    const encoded = event(item.tick - previous, item.bytes);
    previous = item.tick;
    return encoded;
  }), event(0, [0xff, 0x2f, 0x00])]);
  return content;
}

function noteTrack(track: MidiTrackDefinition) {
  const events: Array<{ tick: number; order: number; bytes: number[] }> = [];
  events.push({ tick: 0, order: 0, bytes: [0xff, 0x03, ...text(track.name)] });
  if (!track.isDrum) {
    events.push({ tick: 0, order: 0, bytes: [0xc0 | (track.channel & 0x0f), track.program & 0x7f] });
  }
  for (const note of track.notes) {
    const start = Math.round(note.startBeat * ticksPerBeat);
    const end = Math.round((note.startBeat + note.durationBeats) * ticksPerBeat);
    events.push({ tick: start, order: 1, bytes: [0x90 | (track.channel & 0x0f), note.pitch, note.velocity] });
    events.push({ tick: end, order: 0, bytes: [0x80 | (track.channel & 0x0f), note.pitch, 0] });
  }
  events.sort((left, right) => left.tick - right.tick || left.order - right.order);
  let previous = 0;
  return Buffer.concat([...events.map((item) => {
    const encoded = event(item.tick - previous, item.bytes);
    previous = item.tick;
    return encoded;
  }), event(0, [0xff, 0x2f, 0x00])]);
}

export function writeMidi(music: StructuredMusic): Buffer {
  const song: MultiTrackMidiSong = {
    trackName: music.trackName,
    tempo: music.tempo,
    timeSignature: music.timeSignature,
    tracks: [
      {
        role: "melody",
        name: music.trackName,
        channel: 0,
        program: 81,
        isDrum: false,
        notes: music.notes,
      },
    ],
  };
  return writeMultiTrackMidi(song, true);
}

export function writeMultiTrackMidi(song: MultiTrackMidiSong, mergeToSingleTrack = false): Buffer {
  const sourceTracks = mergeToSingleTrack
    ? [{
      role: "melody" as const,
      name: song.trackName,
      channel: 0,
      program: 81,
      isDrum: false,
      notes: song.tracks.flatMap((track) => track.notes).sort((left, right) => left.startBeat - right.startBeat || left.pitch - right.pitch),
    }]
    : song.tracks;
  const tracks = [chunk(tempoTrack(song.trackName, song.tempo, song.timeSignature)), ...sourceTracks.map((track) => chunk(noteTrack(track)))];
  const format = mergeToSingleTrack ? 0 : 1;
  return Buffer.concat([
    Buffer.from("MThd"),
    Buffer.from([0, 0, 0, 6, 0, format, 0, tracks.length, (ticksPerBeat >> 8) & 255, ticksPerBeat & 255]),
    ...tracks,
  ]);
}
