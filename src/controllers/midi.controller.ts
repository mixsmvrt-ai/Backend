import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { enhanceGeneration } from "../services/midiEnhancement.service.js";

export async function enhance(request: AuthRequest, response: Response) {
  const midiId = typeof request.body?.midiId === "string" ? request.body.midiId : "";
  const mode = request.body?.mode === "harder" ? "harder" : null;
  if (!midiId || !mode) {
    response.status(422).json({ error: "midiId and mode=harder are required" });
    return;
  }
  try {
    response.status(201).json({ data: await enhanceGeneration(request.user!.id, midiId, mode) });
  } catch (error) {
    response.status(502).json({ error: error instanceof Error ? error.message : "Unable to enhance MIDI" });
  }
}
