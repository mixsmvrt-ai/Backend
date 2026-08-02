import { artistProfileCatalog } from "./artistMapping.js";
import type { DetectedArtistReference } from "./types.js";

export class ArtistDetectionService {
  async detect(prompt: string): Promise<DetectedArtistReference[]> {
    const text = prompt.toLowerCase();
    const matches: DetectedArtistReference[] = [];
    const seen = new Set<string>();

    for (const profile of await artistProfileCatalog.profiles()) {
      const aliases = [profile.artistName, ...profile.aliases].sort((left, right) => right.length - left.length);
      for (const alias of aliases) {
        const normalizedAlias = alias.toLowerCase();
        if (!text.includes(normalizedAlias)) continue;
        if (seen.has(profile.artistName)) break;
        matches.push({ artistName: profile.artistName, matchedText: alias, score: normalizedAlias.length, profile });
        seen.add(profile.artistName);
        break;
      }
    }

    return matches.sort((left, right) => right.score - left.score);
  }
}

export const artistDetectionService = new ArtistDetectionService();