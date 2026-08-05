import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { songPackCreateSchema, songPackRegeneratePartSchema, generateSongPack, listSongPacks, readSongPack, regenerateEntireSongPack, regenerateSongPackPart, songPackAdminOverview, songPackCredits } from "../services/songPackCompact.service.js";

function statusOf(error: unknown) {
  return (error as { statusCode?: number }).statusCode ?? 500;
}

export async function credits(request: AuthRequest, response: Response) {
  try {
    response.json({ data: await songPackCredits(request.user!.id) });
  } catch (error) {
    response.status(statusOf(error)).json({ error: error instanceof Error ? error.message : "Unable to load song pack credits" });
  }
}

export async function list(request: AuthRequest, response: Response) {
  try {
    response.json({ data: await listSongPacks(request.user!.id) });
  } catch (error) {
    response.status(statusOf(error)).json({ error: error instanceof Error ? error.message : "Unable to list song packs" });
  }
}

export async function read(request: AuthRequest, response: Response) {
  try {
    response.json(await readSongPack(request.user!.id, String(request.params.songPackId)));
  } catch (error) {
    response.status(statusOf(error)).json({ error: error instanceof Error ? error.message : "Unable to read song pack" });
  }
}

export async function create(request: AuthRequest, response: Response) {
  const parsed = songPackCreateSchema.safeParse(request.body);
  if (!parsed.success) return response.status(422).json({ error: "Invalid song pack request", details: parsed.error.flatten() });
  try {
    response.status(201).json({ data: await generateSongPack(request.user!.id, parsed.data) });
  } catch (error) {
    response.status(statusOf(error)).json({ error: error instanceof Error ? error.message : "Unable to generate song pack" });
  }
}

export async function regeneratePart(request: AuthRequest, response: Response) {
  const parsed = songPackRegeneratePartSchema.safeParse(request.body ?? {});
  if (!parsed.success) return response.status(422).json({ error: "Invalid song pack part regeneration request", details: parsed.error.flatten() });
  try {
    response.json({ data: await regenerateSongPackPart(request.user!.id, String(request.params.songPackId), String(request.params.partId), parsed.data.promptOverride) });
  } catch (error) {
    response.status(statusOf(error)).json({ error: error instanceof Error ? error.message : "Unable to regenerate song pack part" });
  }
}

export async function regeneratePack(request: AuthRequest, response: Response) {
  try {
    response.json({ data: await regenerateEntireSongPack(request.user!.id, String(request.params.songPackId)) });
  } catch (error) {
    response.status(statusOf(error)).json({ error: error instanceof Error ? error.message : "Unable to regenerate song pack" });
  }
}

export async function adminOverview(_request: AuthRequest, response: Response) {
  try {
    response.json({ data: await songPackAdminOverview() });
  } catch (error) {
    response.status(statusOf(error)).json({ error: error instanceof Error ? error.message : "Unable to load song pack overview" });
  }
}