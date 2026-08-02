import { randomUUID } from "node:crypto";
import type { Generation, GenerationInput } from "../domain/music.js";

const records = new Map<string, Generation[]>();
export function createGeneration(userId: string, input: GenerationInput): Generation {
  const generation: Generation = { id: randomUUID(), status: "completed", prompt: input.prompt, kind: input.kind, createdAt: new Date().toISOString(), fileName: `${input.kind}-${Date.now()}.mid` };
  records.set(userId, [generation, ...(records.get(userId) ?? [])]);
  return generation;
}
export function listGenerations(userId: string): Generation[] { return records.get(userId) ?? []; }
export function findGeneration(userId: string, id: string): Generation | undefined { return listGenerations(userId).find((item) => item.id === id); }
