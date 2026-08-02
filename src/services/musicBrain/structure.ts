import type { GenerationType, SupportedGenre } from "./types.js";

export function inferSongLength(prompt: string, explicitBars?: number) {
  if (explicitBars && explicitBars >= 1 && explicitBars <= 128) return `${explicitBars} Bars`;
  const match = prompt.match(/\b(\d{1,3})\s*(bar|bars)\b/i);
  if (match) return `${Math.min(Math.max(Number(match[1]), 1), 128)} Bars`;
  if (/\b(loop|starter|idea)\b/i.test(prompt)) return "8 Bars";
  if (/\b(full song|full composition|arrangement)\b/i.test(prompt)) return "32 Bars";
  return "16 Bars";
}

export function inferTimeSignature(prompt: string, explicit?: [number, number], preferredSignatures: string[] = []): [number, number] {
  if (explicit) return explicit;
  const match = prompt.match(/\b(3\/4|4\/4|6\/8|7\/8)\b/);
  if (!match && preferredSignatures.length > 0) {
    const [top, bottom] = preferredSignatures[0].split("/").map(Number);
    if (Number.isInteger(top) && Number.isInteger(bottom)) return [top, bottom] as [number, number];
  }
  if (!match) return [4, 4];
  const [top, bottom] = match[1].split("/").map(Number);
  return [top, bottom] as [number, number];
}

export function inferStructure(genre: SupportedGenre, generationType: GenerationType, songLength: string) {
  const bars = Number(songLength.match(/\d+/)?.[0] ?? 16);
  if (generationType !== "Full Composition") return [{ name: "Loop", bars }];
  if (genre === "Trap" || genre === "Drill") return [{ name: "Intro", bars: 4 }, { name: "Hook", bars: 8 }, { name: "Verse", bars: bars - 12 }];
  return [{ name: "Intro", bars: 4 }, { name: "A Section", bars: 8 }, { name: "B Section", bars: Math.max(4, bars - 12) }];
}
