import { clampMidi, confidenceBand, frequencyFromMidi, midiFromFrequency, round, scientificNameFromMidi, velocityFromAmplitude, average } from "./utils.js";
import type { DetectedNote, PitchCurvePoint, PitchFrameAnalysis, PitchProviderTuning } from "./types.js";

type FrameGroup = PitchFrameAnalysis[];

function finalizeGroup(group: FrameGroup): DetectedNote {
  const weightedMidi = group.reduce((sum, frame) => sum + (frame.midiFloat ?? frame.midi ?? 0) * Math.max(frame.confidence, 0.01), 0) /
    group.reduce((sum, frame) => sum + Math.max(frame.confidence, 0.01), 0);
  const midi = clampMidi(Math.round(weightedMidi));
  const frequency = frequencyFromMidi(weightedMidi);
  const startTime = round(group[0].time);
  const endTime = round(group[group.length - 1].endTime);
  const duration = round(endTime - startTime);
  const confidence = round(average(group.map((frame) => frame.confidence)));
  const amplitude = average(group.map((frame) => frame.amplitude));

  const pitchCurve: PitchCurvePoint[] = group.map((frame) => ({
    time: round(frame.time),
    frequency: frame.frequency,
    midi: frame.midi,
    noteName: frame.noteName,
    confidence: round(frame.confidence),
    amplitude: round(frame.amplitude),
  }));

  return {
    midi,
    noteName: scientificNameFromMidi(midi).replace(/\d+$/, ""),
    scientificName: scientificNameFromMidi(midi),
    frequency: round(frequency),
    velocity: velocityFromAmplitude(amplitude),
    confidence,
    confidenceBand: confidenceBand(confidence),
    startTime,
    endTime,
    duration,
    pitchCurve,
  };
}

function mergeAdjacentNotes(notes: DetectedNote[], tuning: PitchProviderTuning) {
  const merged: DetectedNote[] = [];
  for (const note of notes) {
    const previous = merged[merged.length - 1];
    if (
      previous &&
      Math.abs(previous.midi - note.midi) === 0 &&
      note.startTime - previous.endTime <= tuning.onsetGapSeconds
    ) {
      previous.endTime = note.endTime;
      previous.duration = round(previous.endTime - previous.startTime);
      previous.confidence = round((previous.confidence * previous.pitchCurve.length + note.confidence * note.pitchCurve.length) / (previous.pitchCurve.length + note.pitchCurve.length));
      previous.velocity = Math.max(previous.velocity, note.velocity);
      previous.pitchCurve.push(...note.pitchCurve);
      continue;
    }
    merged.push({ ...note, pitchCurve: [...note.pitchCurve] });
  }
  return merged;
}

export function detectNotes(frames: PitchFrameAnalysis[], tuning: PitchProviderTuning) {
  const notes: DetectedNote[] = [];
  let current: FrameGroup = [];

  for (const frame of frames) {
    const pitchless = frame.midi === null;
    if (pitchless) {
      if (current.length > 0) {
        const note = finalizeGroup(current);
        if (note.duration >= tuning.minNoteDurationSeconds) notes.push(note);
        current = [];
      }
      continue;
    }

    if (current.length === 0) {
      current.push(frame);
      continue;
    }

    const previous = current[current.length - 1];
    const semitoneDistance = Math.abs((previous.midi ?? frame.midi ?? 0) - (frame.midi ?? previous.midi ?? 0));
    const gap = frame.time - previous.endTime;

      if (semitoneDistance === 0 && gap <= tuning.onsetGapSeconds) {
      current.push(frame);
      continue;
    }

    const note = finalizeGroup(current);
    if (note.duration >= tuning.minNoteDurationSeconds) notes.push(note);
    current = [frame];
  }

  if (current.length > 0) {
    const note = finalizeGroup(current);
    if (note.duration >= tuning.minNoteDurationSeconds) notes.push(note);
  }

  return mergeAdjacentNotes(notes, tuning).filter((note) => note.duration >= tuning.minNoteDurationSeconds);
}

export function pitchCurveFromFrames(frames: PitchFrameAnalysis[]) {
  return frames.map((frame) => ({
    time: round(frame.time),
    frequency: frame.frequency ? round(frame.frequency) : null,
    midi: frame.midi,
    noteName: frame.noteName,
    confidence: round(frame.confidence),
    amplitude: round(frame.amplitude),
  }));
}

export function intervalSeries(notes: DetectedNote[]) {
  const intervals: number[] = [];
  for (let index = 1; index < notes.length; index += 1) {
    intervals.push(notes[index].midi - notes[index - 1].midi);
  }
  return intervals;
}

export function averageDetectedFrequency(notes: DetectedNote[]) {
  return notes.map((note) => note.frequency);
}

export function detectedMidiNumbers(notes: DetectedNote[]) {
  return notes.map((note) => note.midi);
}