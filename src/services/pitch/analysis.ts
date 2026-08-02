import { MAX_SUPPORTED_FREQUENCY, MIN_SUPPORTED_FREQUENCY } from "./constants.js";
import { average, clamp, clampMidi, midiFromFrequency, movingMedian, readMonoPcmWav, round, scientificNameFromMidi } from "./utils.js";
import { PitchAnalysisError, type PitchAnalysisResult, type PitchAudioSource, type PitchFrameAnalysis, type PitchProviderName, type PitchProviderTuning } from "./types.js";
import { overallConfidence } from "./confidence.js";
import { analyzeMelody, estimateKey } from "./musicDetection.js";
import { averageDetectedFrequency, detectedMidiNumbers, detectNotes, pitchCurveFromFrames } from "./notes.js";
import { analyzeRhythm } from "./rhythm.js";
import { detectSilenceRegions } from "./timing.js";

function rms(frame: Float32Array) {
  let sum = 0;
  for (let index = 0; index < frame.length; index += 1) sum += frame[index] ** 2;
  return Math.sqrt(sum / frame.length);
}

function windowedFrame(frame: Float32Array) {
  const result = new Float32Array(frame.length);
  for (let index = 0; index < frame.length; index += 1) {
    const weight = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (frame.length - 1));
    result[index] = frame[index] * weight;
  }
  return result;
}

function normalizedAutoCorrelation(frame: Float32Array, minLag: number, maxLag: number) {
  const scores: number[] = [];
  const peaks: Array<{ lag: number; score: number }> = [];

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let correlation = 0;
    let leftEnergy = 0;
    let rightEnergy = 0;

    for (let index = 0; index + lag < frame.length; index += 1) {
      const left = frame[index];
      const right = frame[index + lag];
      correlation += left * right;
      leftEnergy += left * left;
      rightEnergy += right * right;
    }

    const score = correlation / Math.sqrt(Math.max(leftEnergy * rightEnergy, 1e-9));
    scores.push(score);
  }

  let bestLag = minLag;
  let bestScore = -1;
  for (let index = 0; index < scores.length; index += 1) {
    const score = scores[index];
    if (score > bestScore) {
      bestScore = score;
      bestLag = index + minLag;
    }
    const left = scores[index - 1] ?? -Infinity;
    const right = scores[index + 1] ?? -Infinity;
    if (score > left && score >= right) {
      peaks.push({ lag: index + minLag, score });
    }
  }

  const primaryPeak = peaks.find((peak) => peak.score >= Math.max(0.92 * bestScore, 0.5)) ?? peaks[0] ?? { lag: bestLag, score: bestScore };
  const secondaryPeak = peaks
    .filter((peak) => peak.lag !== primaryPeak.lag)
    .reduce((best, peak) => peak.score > best ? peak.score : best, 0);

  return { scores, bestLag: primaryPeak.lag, bestScore: primaryPeak.score, secondScore: Math.max(secondaryPeak, 0) };
}

function interpolateLag(scores: number[], lag: number, minLag: number) {
  const index = lag - minLag;
  const left = scores[index - 1] ?? scores[index];
  const center = scores[index] ?? 0;
  const right = scores[index + 1] ?? scores[index];
  const denominator = left - 2 * center + right;
  if (Math.abs(denominator) < 1e-9) return lag;
  return lag + (left - right) / (2 * denominator);
}

function analyzeFrames(samples: Float32Array, sampleRate: number, tuning: PitchProviderTuning): PitchFrameAnalysis[] {
  const minLag = Math.max(8, Math.floor(sampleRate / MAX_SUPPORTED_FREQUENCY));
  const maxLag = Math.min(tuning.frameSize - 2, Math.ceil(sampleRate / MIN_SUPPORTED_FREQUENCY));
  const frames: PitchFrameAnalysis[] = [];

  for (let offset = 0; offset + tuning.frameSize <= samples.length; offset += tuning.hopSize) {
    const frame = windowedFrame(samples.slice(offset, offset + tuning.frameSize));
    const amplitude = rms(frame);
    const time = offset / sampleRate;
    const endTime = (offset + tuning.frameSize) / sampleRate;

    if (amplitude < tuning.silenceThreshold) {
      frames.push({ time, endTime, frequency: null, midiFloat: null, midi: null, confidence: 0, amplitude, noteName: null, secondaryPeakRatio: 0 });
      continue;
    }

    const { scores, bestLag, bestScore, secondScore } = normalizedAutoCorrelation(frame, minLag, maxLag);
    if (bestScore < tuning.minCorrelation * 0.45) {
      frames.push({ time, endTime, frequency: null, midiFloat: null, midi: null, confidence: clamp(bestScore, 0, 1), amplitude, noteName: null, secondaryPeakRatio: 1 });
      continue;
    }

    const refinedLag = interpolateLag(scores, bestLag, minLag);
    const frequency = sampleRate / refinedLag;
    if (frequency < MIN_SUPPORTED_FREQUENCY || frequency > MAX_SUPPORTED_FREQUENCY) {
      frames.push({ time, endTime, frequency: null, midiFloat: null, midi: null, confidence: 0, amplitude, noteName: null, secondaryPeakRatio: 1 });
      continue;
    }

    const midiFloat = midiFromFrequency(frequency);
    const midi = clampMidi(Math.round(midiFloat));
    const clarity = clamp((bestScore - tuning.minCorrelation * 0.4) / (1 - tuning.minCorrelation * 0.4), 0, 1);
    const amplitudeFactor = clamp((amplitude - tuning.silenceThreshold) / 0.4, 0, 1);
    const secondaryPeakRatio = clamp(secondScore / Math.max(bestScore, 1e-6), 0, 1);
    const confidence = clamp(clarity * 0.7 + amplitudeFactor * 0.2 + (1 - secondaryPeakRatio) * 0.1, 0, 1);
    frames.push({
      time,
      endTime,
      frequency,
      midiFloat,
      midi,
      confidence,
      amplitude,
      noteName: scientificNameFromMidi(midi),
      secondaryPeakRatio,
    });
  }

  const smoothedMidi = movingMedian(frames.map((frame) => frame.midiFloat), tuning.smoothingFrames);
  return frames.map((frame, index) => {
    const midiFloat = smoothedMidi[index];
    if (midiFloat === null || frame.frequency === null) return frame;
    const midi = clampMidi(Math.round(midiFloat));
    return {
      ...frame,
      midiFloat,
      midi,
      frequency: 440 * 2 ** ((midiFloat - 69) / 12),
      noteName: scientificNameFromMidi(midi),
    };
  });
}

export async function analyzeProcessedWav(filePath: string, source: PitchAudioSource, provider: PitchProviderName, tuning: PitchProviderTuning, threshold: number): Promise<PitchAnalysisResult> {
  const wav = await readMonoPcmWav(filePath);
  if (wav.durationSeconds < 0.05) {
    throw new PitchAnalysisError("Processed recording is empty.", "PITCH_EMPTY_RECORDING", 422);
  }

  const frames = analyzeFrames(wav.samples, wav.sampleRate, tuning);
  const notes = detectNotes(frames, tuning);
  const voicedFrames = frames.filter((frame) => frame.amplitude >= tuning.silenceThreshold).length;
  if (notes.length === 0) {
    throw new PitchAnalysisError(
      voicedFrames > 0 ? "Pitch analysis confidence is below the configured threshold." : "No melody detected in processed audio.",
      voicedFrames > 0 ? "PITCH_LOW_CONFIDENCE" : "PITCH_NO_MELODY",
      422,
    );
  }

  const rhythm = analyzeRhythm(notes, wav.durationSeconds);
  const keyEstimate = estimateKey(notes);
  const curve = pitchCurveFromFrames(frames);
  const silenceRegions = detectSilenceRegions(curve, tuning.silenceThreshold);
  const confidence = overallConfidence(notes, frames, threshold);
  if (confidence.overall < threshold) {
    throw new PitchAnalysisError("Pitch analysis confidence is below the configured threshold.", "PITCH_LOW_CONFIDENCE", 422);
  }

  const polyphonicLikelihood = average(frames.map((frame) => frame.secondaryPeakRatio));
  const melody = analyzeMelody(notes, polyphonicLikelihood, rhythm.timing.phraseBoundaries);
  const pitchRange = notes.reduce<{ minMidi: number | null; maxMidi: number | null }>((range, note) => ({
    minMidi: range.minMidi === null ? note.midi : Math.min(range.minMidi, note.midi),
    maxMidi: range.maxMidi === null ? note.midi : Math.max(range.maxMidi, note.midi),
  }), { minMidi: null, maxMidi: null });

  return {
    recording: {
      provider,
      audioUploadId: source.id,
      durationSeconds: round(wav.durationSeconds),
      sampleRate: wav.sampleRate,
      channels: wav.channels,
    },
    detectedNotes: notes,
    detectedMidiNumbers: detectedMidiNumbers(notes),
    frequencies: averageDetectedFrequency(notes),
    timing: rhythm.timing,
    tempo: rhythm.tempo,
    estimatedKey: keyEstimate,
    estimatedScale: keyEstimate,
    confidence,
    pitchCurve: curve,
    silenceRegions,
    melody,
    statistics: {
      noteCount: notes.length,
      uniqueMidiCount: new Set(notes.map((note) => note.midi)).size,
      averageNoteDuration: round(average(notes.map((note) => note.duration))),
      pitchRange,
      voicedFrameRatio: round(confidence.voicedFrameRatio),
      averageConfidence: round(confidence.noteAverage),
      repeatedNoteRatio: notes.length <= 1 ? 0 : round(melody.repeatedNotes / (notes.length - 1)),
      polyphonicLikelihood: round(polyphonicLikelihood),
    },
  };
}