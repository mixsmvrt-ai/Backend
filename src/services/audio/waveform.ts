import { readFile } from "node:fs/promises";
import { DEFAULT_WAVEFORM_BUCKETS } from "./constants.js";

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

export class WaveformService {
  async peaks(filePath: string, buckets = DEFAULT_WAVEFORM_BUCKETS): Promise<number[]> {
    const buffer = await readFile(filePath);
    if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
      return [];
    }

    const formatChunk = findChunk(buffer, "fmt ");
    const dataChunk = findChunk(buffer, "data");
    if (!formatChunk || !dataChunk) {
      return [];
    }

    const audioFormat = buffer.readUInt16LE(formatChunk.offset);
    const channels = buffer.readUInt16LE(formatChunk.offset + 2);
    const bitsPerSample = buffer.readUInt16LE(formatChunk.offset + 14);
    if (audioFormat !== 1 || bitsPerSample !== 16 || channels < 1) {
      return [];
    }

    const sampleCount = Math.floor(dataChunk.size / 2 / channels);
    if (sampleCount === 0) {
      return [];
    }

    const bucketSize = Math.max(1, Math.floor(sampleCount / buckets));
    const peaks: number[] = [];
    for (let bucket = 0; bucket < buckets; bucket += 1) {
      let peak = 0;
      const startSample = bucket * bucketSize;
      const endSample = Math.min(sampleCount, startSample + bucketSize);
      for (let index = startSample; index < endSample; index += 1) {
        const sampleOffset = dataChunk.offset + index * channels * 2;
        const value = Math.abs(buffer.readInt16LE(sampleOffset));
        peak = Math.max(peak, value);
      }
      peaks.push(Number((peak / 32767).toFixed(4)));
    }

    return peaks;
  }
}

export const waveformService = new WaveformService();