import { spawn } from "node:child_process";
import { platform } from "node:os";
import { env } from "../../config/env.js";
import { parseDecibelLine, parseNumeric, parseSilenceDuration } from "./utils.js";
import type { AudioFfmpegPort, AudioLevels, AudioProbeResult } from "./types.js";
import { AudioProcessingError } from "./types.js";

type CommandResult = {
  stdout: string;
  stderr: string;
};

export class FfmpegService implements AudioFfmpegPort {
  constructor(
    private readonly ffmpegPath = env.AUDIO_FFMPEG_PATH,
    private readonly ffprobePath = env.AUDIO_FFPROBE_PATH,
  ) {}

  async probe(filePath: string): Promise<AudioProbeResult> {
    const { stdout } = await this.run(this.ffprobePath, [
      "-v", "error",
      "-print_format", "json",
      "-show_streams",
      "-show_format",
      filePath,
    ]);

    const parsed = JSON.parse(stdout) as {
      format?: { duration?: string; bit_rate?: string };
      streams?: Array<{ codec_type?: string; codec_name?: string; sample_rate?: string; channels?: number; bits_per_sample?: number; bit_rate?: string }>;
    };
    const audioStream = parsed.streams?.find((stream) => stream.codec_type === "audio");
    if (!audioStream) {
      throw new AudioProcessingError("Uploaded file does not contain a readable audio stream.", "AUDIO_CORRUPT", 422);
    }

    return {
      durationSeconds: parseNumeric(parsed.format?.duration) ?? 0,
      sampleRate: parseNumeric(audioStream.sample_rate) ?? 0,
      channels: audioStream.channels ?? 0,
      bitDepth: audioStream.bits_per_sample,
      codec: audioStream.codec_name ?? "unknown",
      bitrate: parseNumeric(audioStream.bit_rate ?? parsed.format?.bit_rate),
    };
  }

  async analyzeLevels(filePath: string): Promise<AudioLevels> {
    const sink = platform() === "win32" ? "NUL" : "/dev/null";
    const { stderr } = await this.run(this.ffmpegPath, [
      "-hide_banner",
      "-i", filePath,
      "-af", "volumedetect",
      "-f", "null",
      sink,
    ]);
    return {
      peakLevelDb: parseDecibelLine(stderr, "max_volume"),
      rmsLevelDb: parseDecibelLine(stderr, "mean_volume"),
    };
  }

  async detectSilence(filePath: string): Promise<number> {
    const sink = platform() === "win32" ? "NUL" : "/dev/null";
    const { stderr } = await this.run(this.ffmpegPath, [
      "-hide_banner",
      "-i", filePath,
      "-af", "silencedetect=noise=-50dB:d=0.15",
      "-f", "null",
      sink,
    ]);
    return parseSilenceDuration(stderr);
  }

  async processToDetectionWav(inputPath: string, outputPath: string, filters: string[], sampleRate: number, timeoutMs: number): Promise<void> {
    await this.run(this.ffmpegPath, [
      "-hide_banner",
      "-y",
      "-i", inputPath,
      "-vn",
      "-af", filters.join(","),
      "-ac", "1",
      "-ar", String(sampleRate),
      "-c:a", "pcm_s16le",
      outputPath,
    ], timeoutMs);
  }

  private run(command: string, args: string[], timeoutMs = env.AUDIO_PROCESS_TIMEOUT_MS): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill();
        reject(new AudioProcessingError("Audio processing timed out.", "AUDIO_TIMEOUT", 504));
      }, timeoutMs);

      child.stdout.on("data", (chunk: Buffer | string) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(new AudioProcessingError(`Failed to start FFmpeg: ${error.message}`, "FFMPEG_UNAVAILABLE", 500));
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new AudioProcessingError(`FFmpeg failed: ${stderr.trim() || `exit code ${code}`}`, "FFMPEG_FAILURE", 502));
          return;
        }
        resolve({ stdout, stderr });
      });
    });
  }
}

export const ffmpegService = new FfmpegService();