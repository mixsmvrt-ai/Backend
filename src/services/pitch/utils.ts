import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NOTE_NAMES, DEFAULT_PITCH_TEMP_DIR_NAME, MAX_SUPPORTED_MIDI, MIN_SUPPORTED_MIDI } from "./constants.js";
import { PitchAnalysisError, type ConfidenceBand, type PitchWavData } from "./types.js";

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, places = 4) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function createPitchTempWorkspace(baseDir = tmpdir()) {
  return mkdir(join(baseDir, DEFAULT_PITCH_TEMP_DIR_NAME), { recursive: true })
    .then(() => mkdtemp(join(baseDir, DEFAULT_PITCH_TEMP_DIR_NAME, `${Date.now()}-`)));
}

export function cleanupPitchTempWorkspace(path: string) {
  return rm(path, { recursive: true, force: true });
}

export async function writeTempFile(path: string, buffer: Buffer) {
  await writeFile(path, buffer);
}

export function midiFromFrequency(frequency: number) {
  return 69 + 12 * Math.log2(frequency / 440);
}

export function frequencyFromMidi(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function scientificNameFromMidi(midi: number) {
  const note = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= 0.75) return "high";
  if (confidence >= 0.5) return "medium";
  return "low";
}

export function cosineSimilarity(left: number[], right: number[]) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] ** 2;
    rightNorm += right[index] ** 2;
  }
  return dot / Math.sqrt(Math.max(leftNorm * rightNorm, 1e-9));
}

export function rotate<T>(values: T[], offset: number) {
  const normalized = ((offset % values.length) + values.length) % values.length;
  return [...values.slice(normalized), ...values.slice(0, normalized)];
}

export function normalizeHistogram(values: number[]) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return values.map(() => 0);
  return values.map((value) => value / total);
}

export function movingMedian(values: Array<number | null>, windowSize: number) {
  if (windowSize <= 1) return values;
  const radius = Math.floor(windowSize / 2);
  return values.map((value, index) => {
    if (value === null) return null;
    const window = values.slice(Math.max(0, index - radius), Math.min(values.length, index + radius + 1)).filter((entry): entry is number => entry !== null);
    return window.length === 0 ? value : median(window);
  });
}

export function withTimeout<T>(work: Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new PitchAnalysisError(message, "PITCH_ANALYSIS_TIMEOUT", 504)), timeoutMs);
    work.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }).catch((error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function findChunk(buffer: Buffer, chunkId: string) {
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (id === chunkId) {
      return { offset: offset + 8, size };
    }
    offset += 8 + size + (size % 2);
  }
  return undefined;
}

export async function readMonoPcmWav(filePath: string): Promise<PitchWavData> {
  const buffer = await readFile(filePath);
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new PitchAnalysisError("Processed audio is not a valid WAV recording.", "PITCH_CORRUPT_AUDIO", 422);
  }

  const fmtChunk = findChunk(buffer, "fmt ");
  const dataChunk = findChunk(buffer, "data");
  if (!fmtChunk || !dataChunk) {
    throw new PitchAnalysisError("Processed audio is missing WAV metadata.", "PITCH_CORRUPT_AUDIO", 422);
  }

  const audioFormat = buffer.readUInt16LE(fmtChunk.offset);
  const channels = buffer.readUInt16LE(fmtChunk.offset + 2);
  const sampleRate = buffer.readUInt32LE(fmtChunk.offset + 4);
  const bitsPerSample = buffer.readUInt16LE(fmtChunk.offset + 14);

  if (audioFormat !== 1 || bitsPerSample !== 16) {
    throw new PitchAnalysisError("Pitch detection requires PCM16 WAV input.", "PITCH_UNSUPPORTED_AUDIO", 422);
  }

  const frameCount = Math.floor(dataChunk.size / 2 / channels);
  if (frameCount <= 0) {
    throw new PitchAnalysisError("Processed audio is empty.", "PITCH_EMPTY_RECORDING", 422);
  }

  const samples = new Float32Array(frameCount);
  for (let frame = 0; frame < frameCount; frame += 1) {
    let mixed = 0;
    for (let channel = 0; channel < channels; channel += 1) {
      const offset = dataChunk.offset + (frame * channels + channel) * 2;
      mixed += buffer.readInt16LE(offset) / 32768;
    }
    samples[frame] = mixed / channels;
  }

  return {
    sampleRate,
    channels,
    durationSeconds: frameCount / sampleRate,
    samples,
  };
}

export function velocityFromAmplitude(amplitude: number) {
  return Math.round(clamp(amplitude / 0.55, 0, 1) * 126) + 1;
}

export function clampMidi(midi: number) {
  return Math.round(clamp(midi, MIN_SUPPORTED_MIDI, MAX_SUPPORTED_MIDI));
}