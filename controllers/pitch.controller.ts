import type { Response } from "express";
import { z } from "zod";
import type { AuthRequest } from "../middleware/auth.js";
import { pitchService, PitchAnalysisError } from "../services/pitch/index.js";

const param = (value: string | string[]) => Array.isArray(value) ? value[0] : value;

const analyzeSchema = z.object({
  audioId: z.string().uuid(),
  provider: z.enum(["aubio", "crepe", "essentia"]).optional(),
});

function handleError(response: Response, error: unknown, fallback: string) {
  if (error instanceof PitchAnalysisError) {
    response.status(error.statusCode).json({ error: error.message, code: error.code });
    return;
  }
  response.status(500).json({ error: error instanceof Error ? error.message : fallback });
}

export async function analyze(request: AuthRequest, response: Response) {
  const parsed = analyzeSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(422).json({ error: "Invalid pitch analysis request", details: parsed.error.flatten() });
    return;
  }
  try {
    response.status(201).json({ data: await pitchService.analyze(request.user!.id, parsed.data) });
  } catch (error) {
    handleError(response, error, "Unable to analyze pitch");
  }
}

export async function read(request: AuthRequest, response: Response) {
  try {
    response.json({ data: await pitchService.get(request.user!.id, param(request.params.id)) });
  } catch (error) {
    handleError(response, error, "Unable to read pitch analysis");
  }
}

export async function remove(request: AuthRequest, response: Response) {
  try {
    await pitchService.remove(request.user!.id, param(request.params.id));
    response.status(204).end();
  } catch (error) {
    handleError(response, error, "Unable to delete pitch analysis");
  }
}