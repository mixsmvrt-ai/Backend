import type { Response } from "express";
import { z } from "zod";
import type { AuthRequest } from "../middleware/auth.js";
import { audioProcessor, AudioProcessingError } from "../services/audio/index.js";

const param = (value: string | string[]) => Array.isArray(value) ? value[0] : value;

const uploadSchema = z.object({
  projectId: z.string().uuid().optional(),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().positive(),
});

const processSchema = z.object({
  audioId: z.string().uuid(),
  applyHighPassFilter: z.boolean().optional(),
});

function handleError(response: Response, error: unknown, fallback: string) {
  if (error instanceof AudioProcessingError) {
    response.status(error.statusCode).json({ error: error.message, code: error.code });
    return;
  }
  response.status(500).json({ error: error instanceof Error ? error.message : fallback });
}

export async function upload(request: AuthRequest, response: Response) {
  const parsed = uploadSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(422).json({ error: "Invalid audio upload request", details: parsed.error.flatten() });
    return;
  }
  try {
    response.status(201).json({ data: await audioProcessor.createUploadSession(request.user!.id, parsed.data) });
  } catch (error) {
    handleError(response, error, "Unable to start audio upload");
  }
}

export async function process(request: AuthRequest, response: Response) {
  const parsed = processSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(422).json({ error: "Invalid audio process request", details: parsed.error.flatten() });
    return;
  }
  try {
    response.json({ data: await audioProcessor.process(request.user!.id, parsed.data) });
  } catch (error) {
    handleError(response, error, "Unable to process audio");
  }
}

export async function read(request: AuthRequest, response: Response) {
  try {
    response.json({ data: await audioProcessor.get(request.user!.id, param(request.params.audioId)) });
  } catch (error) {
    handleError(response, error, "Unable to read audio upload");
  }
}

export async function metadata(request: AuthRequest, response: Response) {
  try {
    response.json({ data: await audioProcessor.metadataFor(request.user!.id, param(request.params.audioId)) });
  } catch (error) {
    handleError(response, error, "Unable to read audio metadata");
  }
}

export async function remove(request: AuthRequest, response: Response) {
  try {
    await audioProcessor.remove(request.user!.id, param(request.params.audioId));
    response.status(204).end();
  } catch (error) {
    handleError(response, error, "Unable to delete audio upload");
  }
}