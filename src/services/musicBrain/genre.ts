import { GENRE_KEYWORDS, SUPPORTED_GENRES } from "./constants.js";
import type { SupportedGenre } from "./types.js";

const normalize = (value: string) => value.toLowerCase();

export function detectGenre(prompt: string, explicitGenre?: string): SupportedGenre {
  if (explicitGenre) {
    const match = SUPPORTED_GENRES.find((genre) => genre.toLowerCase() === explicitGenre.toLowerCase());
    if (match) return match;
  }

  const text = normalize(prompt);
  let best: { genre: SupportedGenre; score: number } | null = null;
  for (const [genre, keywords] of Object.entries(GENRE_KEYWORDS) as Array<[SupportedGenre, string[]]>) {
    const score = keywords.reduce((total, keyword) => total + (text.includes(keyword) ? keyword.length : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { genre, score };
  }

  if (best) return best.genre;
  if (/\b(rap|rapper|verse)\b/i.test(prompt)) return "Hip Hop";
  if (/\b(sad|dark|emotional).*\b(piano|bell|808)\b/i.test(prompt)) return "Trap";
  return "Pop";
}
