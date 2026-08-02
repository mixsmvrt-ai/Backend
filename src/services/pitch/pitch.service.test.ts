import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PitchProviderFactory } from "./pitch.factory.js";
import type { PitchAnalysisRepository } from "./pitch.interface.js";
import { PitchService } from "./pitch.service.js";
import { AubioProvider } from "./providers/aubio.provider.js";
import { CrepeProvider } from "./providers/crepe.provider.js";
import { EssentiaProvider } from "./providers/essentia.provider.js";
import { type PitchAnalysisRecord, type PitchAnalysisResult, type PitchAudioSource, type PitchProviderName } from "./types.js";

const createdPaths: string[] = [];

describe("Pitch Detection Engine", () => {
  afterEach(async () => {
    await Promise.all(createdPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
  });

  it("detects a single sustained note", async () => {
    const filePath = await createWaveFile([tone(440, 1.1)]);
    const result = await analyzeFile(filePath);
    expect(result.analysis.detectedNotes.length).toBeGreaterThan(0);
    expect(result.analysis.detectedNotes[0]?.scientificName).toBe("A4");
  });

  it("detects an ascending scale recording", async () => {
    const frequencies = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25];
    const segments = frequencies.flatMap((frequency) => [tone(frequency, 0.28), silence(0.03)]);
    const filePath = await createWaveFile(segments);
    const result = await analyzeFile(filePath, "crepe");
    expect(result.analysis.detectedNotes.length).toBeGreaterThanOrEqual(6);
    expect(result.analysis.melody.direction).toBe("ascending");
  });

  it("flags chord recordings as polyphonic and lower confidence", async () => {
    const filePath = await createWaveFile([mix([tone(261.63, 1.0, 0.45), tone(329.63, 1.0, 0.45), tone(392, 1.0, 0.45)])]);
    const result = await analyzeFile(filePath, "essentia");
    expect(result.analysis.statistics.polyphonicLikelihood).toBeGreaterThan(0.45);
  });

  it("tracks fast melody changes", async () => {
    const segments = [523.25, 587.33, 659.25, 698.46, 783.99, 698.46].flatMap((frequency) => [tone(frequency, 0.12), silence(0.015)]);
    const filePath = await createWaveFile(segments);
    const result = await analyzeFile(filePath);
    expect(result.analysis.detectedNotes.length).toBeGreaterThanOrEqual(4);
    expect(result.analysis.tempo.bpm).not.toBeNull();
  });

  it("tracks slow melody phrasing", async () => {
    const segments = [220, 246.94, 261.63].flatMap((frequency) => [tone(frequency, 0.65), silence(0.18)]);
    const filePath = await createWaveFile(segments);
    const result = await analyzeFile(filePath);
    expect(result.analysis.timing.phraseBoundaries.length).toBeGreaterThanOrEqual(1);
    expect(result.analysis.statistics.averageNoteDuration).toBeGreaterThan(0.4);
  });

  it("handles background noise while preserving note detection", async () => {
    const base = tone(329.63, 1.0, 0.65);
    const noisy = addNoise(base, 0.04);
    const filePath = await createWaveFile([noisy]);
    const result = await analyzeFile(filePath);
    expect(result.analysis.detectedNotes[0]?.scientificName).toBe("E4");
    expect(result.analysis.confidence.overall).toBeGreaterThan(0.55);
  });

  it("rejects empty recordings", async () => {
    const filePath = await createWaveFile([silence(0.8)]);
    await expect(analyzeFile(filePath)).rejects.toMatchObject({ code: "PITCH_NO_MELODY" });
  });

  it("rejects low confidence recordings", async () => {
    const weak = addNoise(tone(440, 0.4, 0.04), 0.06);
    const filePath = await createWaveFile([weak]);
    await expect(analyzeFile(filePath)).rejects.toMatchObject({ code: "PITCH_LOW_CONFIDENCE" });
  });
});

async function analyzeFile(filePath: string, provider: PitchProviderName = "aubio") {
  const repository = createRepository(filePath);
  const service = new PitchService(repository, new PitchProviderFactory([new AubioProvider(), new CrepeProvider(), new EssentiaProvider()]));
  return service.analyze("user-1", { audioId: "11111111-1111-1111-1111-111111111111", provider });
}

function createRepository(filePath: string): PitchAnalysisRepository {
  const source: PitchAudioSource = {
    id: "11111111-1111-1111-1111-111111111111",
    userId: "user-1",
    projectId: null,
    status: "processed",
    duration: 1,
    sampleRate: 16000,
    channels: 1,
    processedFile: { bucket: "audio-processed", path: "users/user-1/audio/processed/test.wav", fileName: "test.wav", mimeType: "audio/wav", sizeBytes: 0 },
  };

  return {
    getAudioSource: vi.fn().mockResolvedValue(source),
    downloadProcessedAudio: vi.fn().mockResolvedValue(filePath),
    createAnalysis: vi.fn().mockImplementation(async (_userId, audioSource, providerName, analysis: PitchAnalysisResult) => ({
      id: "analysis-1",
      userId: "user-1",
      projectId: audioSource.projectId,
      audioUploadId: audioSource.id,
      provider: providerName,
      estimatedBpm: analysis.tempo.bpm,
      estimatedKey: analysis.estimatedKey.key,
      estimatedScale: analysis.estimatedScale.scale,
      overallConfidence: analysis.confidence.overall,
      analysis,
      createdAt: new Date().toISOString(),
    } satisfies PitchAnalysisRecord)),
    getAnalysis: vi.fn(),
    deleteAnalysis: vi.fn(),
  };
}

async function createWaveFile(segments: Float32Array[]) {
  const directory = await mkdtemp(join(tmpdir(), "midiflow-pitch-test-"));
  createdPaths.push(directory);
  const filePath = join(directory, "recording.wav");
  const audio = concatenate(segments);
  await writeFile(filePath, buildWav(audio, 16000));
  return filePath;
}

function concatenate(segments: Float32Array[]) {
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  const result = new Float32Array(total);
  let offset = 0;
  for (const segment of segments) {
    result.set(segment, offset);
    offset += segment.length;
  }
  return result;
}

function tone(frequency: number, durationSeconds: number, amplitude = 0.7, sampleRate = 16000) {
  const samples = Math.floor(durationSeconds * sampleRate);
  const result = new Float32Array(samples);
  for (let index = 0; index < samples; index += 1) {
    result[index] = Math.sin((2 * Math.PI * frequency * index) / sampleRate) * amplitude;
  }
  return result;
}

function silence(durationSeconds: number, sampleRate = 16000) {
  return new Float32Array(Math.floor(durationSeconds * sampleRate));
}

function mix(segments: Float32Array[]) {
  const length = Math.max(...segments.map((segment) => segment.length));
  const mixed = new Float32Array(length);
  for (const segment of segments) {
    for (let index = 0; index < length; index += 1) {
      mixed[index] += segment[index] ?? 0;
    }
  }
  const peak = Math.max(...mixed.map((sample) => Math.abs(sample)), 1);
  for (let index = 0; index < mixed.length; index += 1) {
    mixed[index] /= peak;
  }
  return mixed;
}

function addNoise(segment: Float32Array, amount: number) {
  const result = new Float32Array(segment.length);
  for (let index = 0; index < segment.length; index += 1) {
    result[index] = Math.max(-1, Math.min(1, segment[index] + (Math.random() * 2 - 1) * amount));
  }
  return result;
}

function buildWav(samples: Float32Array, sampleRate: number) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(samples.length * 2, 40);

  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.max(-1, Math.min(1, samples[index]));
    buffer.writeInt16LE(Math.round(value * 32767), 44 + index * 2);
  }
  return buffer;
}