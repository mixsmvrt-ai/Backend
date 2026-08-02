import { DANGEROUS_INPUT_PATTERNS } from "./constants.js";
import { MusicBrainValidationError } from "./types.js";

const MAX_PROMPT_LENGTH = 1000;

export function validatePrompt(prompt: string) {
  const normalized = prompt.trim();
  if (!normalized) throw new MusicBrainValidationError("Prompt cannot be empty.");
  if (normalized.length > MAX_PROMPT_LENGTH) throw new MusicBrainValidationError(`Prompt cannot exceed ${MAX_PROMPT_LENGTH} characters.`);
  if (/^[^\p{L}\p{N}]+$/u.test(normalized)) throw new MusicBrainValidationError("Prompt must contain musical direction.");
  if (DANGEROUS_INPUT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    throw new MusicBrainValidationError("Prompt contains unsupported control or credential-seeking instructions.");
  }
  return normalized.replace(/\s+/g, " ");
}
