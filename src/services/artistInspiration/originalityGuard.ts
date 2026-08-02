import { ARTIST_ORIGINALITY_NOTICE, DIRECT_COPY_PATTERNS } from "./constants.js";
import { ArtistOriginalityViolationError } from "./types.js";

export class OriginalityGuardService {
  assertAllowed(prompt: string) {
    if (DIRECT_COPY_PATTERNS.some((pattern) => pattern.test(prompt))) {
      throw new ArtistOriginalityViolationError("Prompt requests direct copying of copyrighted musical material and cannot be fulfilled.");
    }
  }

  notice() {
    return ARTIST_ORIGINALITY_NOTICE;
  }
}

export const originalityGuardService = new OriginalityGuardService();