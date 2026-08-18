import { env } from "../../config/env.js";
import { membershipFor } from "../membership.service.js";
import type { ModelSelectionResult } from "./types.js";

export class ModelSelector {
  async forUser(userId: string): Promise<ModelSelectionResult> {
    const membership = await membershipFor(userId);
    if (membership.active) {
      return {
        membership: "pro",
        primaryModel: env.AI_PRO_MODEL,
        fallbackModel: null,
      };
    }
    return {
      membership: "free",
      primaryModel: env.AI_FREE_MODEL,
      fallbackModel: null,
    };
  }
}

export const modelSelector = new ModelSelector();