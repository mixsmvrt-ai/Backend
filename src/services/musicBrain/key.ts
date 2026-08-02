import type { SupportedMood } from "./types.js";

const MINOR_KEYS = ["A Minor", "C Minor", "D Minor", "E Minor", "F Minor", "G Minor"];
const MAJOR_KEYS = ["C Major", "D Major", "E Major", "F Major", "G Major", "A Major"];

export function detectExplicitKey(prompt: string, explicitKey?: string) {
  if (explicitKey) return normalizeKey(explicitKey);
  const match = prompt.match(/\b([A-G](?:#|b)?)\s*(major|minor|min|maj)\b/i);
  if (!match) return undefined;
  const quality = /min/i.test(match[2]) ? "Minor" : "Major";
  return `${match[1].toUpperCase()} ${quality}`;
}

export function inferScale(mood: SupportedMood, explicitScale?: string, preferredScales: string[] = []) {
  if (explicitScale) return normalizeScale(explicitScale);
  if (preferredScales.length > 0) return normalizeScale(preferredScales[0]);
  return ["Dark", "Sad", "Aggressive", "Melancholy", "Mysterious", "Emotional", "Epic"].includes(mood) ? "Natural Minor" : "Major";
}

export function inferKey(prompt: string, mood: SupportedMood, explicitKey?: string, preferredKeys: string[] = []) {
  const detected = detectExplicitKey(prompt, explicitKey);
  if (detected) return detected;
  if (preferredKeys.length > 0) return preferredKeys[Math.abs(hash(prompt || mood)) % preferredKeys.length];
  const pool = inferScale(mood).includes("Minor") ? MINOR_KEYS : MAJOR_KEYS;
  const index = Math.abs(hash(prompt || mood)) % pool.length;
  if (mood === "Dark") return "F Minor";
  if (mood === "Sad" || mood === "Emotional") return "A Minor";
  return pool[index];
}

function normalizeKey(value: string) {
  return value.replace(/\bmin\b/i, "Minor").replace(/\bmaj\b/i, "Major").replace(/\s+/g, " ").trim();
}

function normalizeScale(value: string) {
  if (/minor/i.test(value)) return "Natural Minor";
  if (/major/i.test(value)) return "Major";
  return value.trim();
}

function hash(value: string) {
  return [...value].reduce((total, char) => ((total << 5) - total + char.charCodeAt(0)) | 0, 0);
}
