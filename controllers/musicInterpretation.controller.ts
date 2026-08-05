import type { Response } from "express";
import { z } from "zod";
import type { AuthRequest } from "../middleware/auth.js";
import { musicInterpretationService, MusicInterpretationError } from "../services/musicInterpretation/index.js";

const param = (value: string | string[]) => Array.isArray(value) ? value[0] : value;

const pitchCurvePointSchema = z.object({
  time: z.number(),
  frequency: z.number().nullable(),
  midi: z.number().int().nullable(),
  noteName: z.string().nullable(),
  confidence: z.number(),
  amplitude: z.number(),
});

const noteSchema = z.object({
  midi: z.number().int(),
  noteName: z.string(),
  scientificName: z.string(),
  frequency: z.number(),
  velocity: z.number().int(),
  confidence: z.number(),
  confidenceBand: z.enum(["low", "medium", "high"]),
  startTime: z.number(),
  endTime: z.number(),
  duration: z.number(),
  pitchCurve: z.array(pitchCurvePointSchema),
});

const analysisSchema = z.object({
  recording: z.object({
    provider: z.enum(["aubio", "crepe", "essentia"]),
    audioUploadId: z.string(),
    durationSeconds: z.number(),
    sampleRate: z.number().int(),
    channels: z.number().int(),
  }),
  detectedNotes: z.array(noteSchema),
  detectedMidiNumbers: z.array(z.number().int()),
  frequencies: z.array(z.number()),
  timing: z.object({ onsetTimes: z.array(z.number()), offsetTimes: z.array(z.number()), noteSpacing: z.array(z.number()), phraseBoundaries: z.array(z.number()) }),
  tempo: z.object({ bpm: z.number().nullable(), confidence: z.number(), beatLocations: z.array(z.number()), swingEstimate: z.number().nullable() }),
  estimatedKey: z.object({ key: z.string().nullable(), scale: z.string().nullable(), mode: z.string().nullable(), confidence: z.number() }),
  estimatedScale: z.object({ key: z.string().nullable(), scale: z.string().nullable(), mode: z.string().nullable(), confidence: z.number() }),
  confidence: z.object({ overall: z.number(), band: z.enum(["low", "medium", "high"]), noteAverage: z.number(), voicedFrameRatio: z.number(), threshold: z.number() }),
  pitchCurve: z.array(pitchCurvePointSchema),
  silenceRegions: z.array(z.object({ startTime: z.number(), endTime: z.number(), duration: z.number() })),
  melody: z.object({
    direction: z.enum(["ascending", "descending", "repeated", "mixed"]),
    pitchContour: z.array(z.enum(["ascending", "descending", "repeated"])),
    repeatingPhrases: z.array(z.object({ pattern: z.string(), occurrences: z.number().int() })),
    intervals: z.array(z.number().int()),
    phraseBoundaries: z.array(z.number()),
    repeatedNotes: z.number().int(),
    polyphonicLikelihood: z.number(),
  }),
  statistics: z.object({
    noteCount: z.number().int(),
    uniqueMidiCount: z.number().int(),
    averageNoteDuration: z.number(),
    pitchRange: z.object({ minMidi: z.number().int().nullable(), maxMidi: z.number().int().nullable() }),
    voicedFrameRatio: z.number(),
    averageConfidence: z.number(),
    repeatedNoteRatio: z.number(),
    polyphonicLikelihood: z.number(),
  }),
});

const interpretSchema = z.object({
  pitchAnalysisId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  analysis: analysisSchema.optional(),
}).refine((value) => Boolean(value.pitchAnalysisId || value.analysis), { message: "pitchAnalysisId or analysis is required", path: ["pitchAnalysisId"] });

function handleError(response: Response, error: unknown, fallback: string) {
  if (error instanceof MusicInterpretationError) {
    response.status(error.statusCode).json({ error: error.message, code: error.code });
    return;
  }
  response.status(500).json({ error: error instanceof Error ? error.message : fallback });
}

export async function interpret(request: AuthRequest, response: Response) {
  const parsed = interpretSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(422).json({ error: "Invalid music interpretation request", details: parsed.error.flatten() });
    return;
  }
  try {
    response.status(201).json({ data: await musicInterpretationService.interpret(request.user!.id, parsed.data) });
  } catch (error) {
    handleError(response, error, "Unable to interpret music");
  }
}

export async function read(request: AuthRequest, response: Response) {
  try {
    response.json({ data: await musicInterpretationService.get(request.user!.id, param(request.params.id)) });
  } catch (error) {
    handleError(response, error, "Unable to read music interpretation");
  }
}

export async function remove(request: AuthRequest, response: Response) {
  try {
    await musicInterpretationService.remove(request.user!.id, param(request.params.id));
    response.status(204).end();
  } catch (error) {
    handleError(response, error, "Unable to delete music interpretation");
  }
}