import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { DEFAULT_AUDIO_TEMP_DIR_NAME } from "./constants.js";

export function extensionOf(fileName: string) {
  return extname(fileName).toLowerCase();
}

export function safeFileName(fileName: string) {
  const trimmed = basename(fileName).trim();
  return trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function buildStoragePath(userId: string, kind: "original" | "processed", fileName: string, projectId?: string) {
  return `users/${userId}/projects/${projectId ?? "unassigned"}/audio/${kind}/${randomUUID()}-${safeFileName(fileName)}`;
}

export async function createTempWorkspace(baseDir: string) {
  const root = join(baseDir || tmpdir(), DEFAULT_AUDIO_TEMP_DIR_NAME);
  await mkdir(root, { recursive: true });
  return mkdtemp(join(root, `${Date.now()}-`));
}

export async function cleanupTempWorkspace(path: string) {
  await rm(path, { recursive: true, force: true });
}

export function parseNumeric(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseDecibelLine(stderr: string, label: string) {
  const regex = new RegExp(`${label}:\\s*(-?\\d+(?:\\.\\d+)?)\\s*dB`, "i");
  const match = stderr.match(regex);
  return match ? Number(match[1]) : undefined;
}

export function parseSilenceDuration(stderr: string) {
  return [...stderr.matchAll(/silence_duration:\s*(\d+(?:\.\d+)?)/g)].reduce((total, match) => total + Number(match[1]), 0);
}