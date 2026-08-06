import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/auth.js";
import { aiGenerateInputSchema, aiRetryInputSchema, aiOrchestrator, AiOrchestrationError } from "../services/ai/index.js";

const discreetServerError = "Server error. Please try again in a few minutes.";

function handleError(response: Response, error: unknown, fallback: string) {
  if (error instanceof AiOrchestrationError) {
    if (error.statusCode >= 500) {
      response.status(error.statusCode).json({ error: discreetServerError });
      return;
    }
    response.status(error.statusCode).json({ error: error.message, code: error.code });
    return;
  }
  response.status(500).json({ error: discreetServerError });
}

export async function generate(request: AuthRequest, response: Response) {
  const parsed = aiGenerateInputSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(422).json({ error: "Invalid AI generate request", details: parsed.error.flatten() });
    return;
  }
  try {
    response.status(201).json({ data: await aiOrchestrator.generate(request.user!.id, parsed.data) });
  } catch (error) {
    handleError(response, error, "Unable to generate AI composition");
  }
}

export async function history(request: AuthRequest, response: Response) {
  try {
    response.json({ data: await aiOrchestrator.history(request.user!.id) });
  } catch (error) {
    handleError(response, error, "Unable to load AI history");
  }
}

export async function usage(request: AuthRequest, response: Response) {
  try {
    response.json({ data: await aiOrchestrator.usage(request.user!.id) });
  } catch (error) {
    handleError(response, error, "Unable to load AI usage");
  }
}

export async function retry(request: AuthRequest, response: Response) {
  const parsed = aiRetryInputSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(422).json({ error: "Invalid AI retry request", details: parsed.error.flatten() });
    return;
  }
  try {
    response.status(201).json({ data: await aiOrchestrator.retry(request.user!.id, parsed.data.requestId) });
  } catch (error) {
    handleError(response, error, "Unable to retry AI request");
  }
}

export async function adminOverview(request: AuthRequest, response: Response) {
  return requireAdmin(request, response, async () => {
    try {
      response.json({ data: await aiOrchestrator.adminOverview() });
    } catch (error) {
      handleError(response, error, "Unable to load AI admin overview");
    }
  });
}