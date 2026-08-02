import { env } from "../../config/env.js";
import { membershipFor } from "../membership.service.js";
import { DEFAULT_FREE_FALLBACK_MODEL, DEFAULT_PRO_FALLBACK_MODEL } from "./constants.js";
import type { ModelSelectionResult } from "./types.js";

export class ModelSelector {
  async forUser(userId: string): Promise<ModelSelectionResult> {
    const membership = await membershipFor(userId);
    if (membership.active) {
      return {
        membership: "pro",
        primaryModel: env.AI_PRO_MODEL,
        fallbackModel: env.AI_PRO_FALLBACK_MODEL ?? DEFAULT_PRO_FALLBACK_MODEL,
      };
    }
    return {
      membership: "free",
      primaryModel: env.AI_FREE_MODEL,
      fallbackModel: env.AI_FREE_FALLBACK_MODEL ?? DEFAULT_FREE_FALLBACK_MODEL,
    };
  }
}

export const modelSelector = new ModelSelector();