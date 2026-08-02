import { jsonValidator } from "../ai/jsonValidator.js";
import { AiOrchestrationError } from "../ai/types.js";
import { normalizeCompactPlan } from "./types.js";

export class CompactPlanValidator {
  validate(content: string) {
    const { value, repaired } = jsonValidator.parse(content);
    try {
      return { plan: normalizeCompactPlan(value), repaired };
    } catch (error) {
      throw new AiOrchestrationError(error instanceof Error ? `Compact plan failed validation: ${error.message}` : "Compact plan failed validation.", "AI_COMPACT_SCHEMA_VALIDATION_FAILED", 502, true);
    }
  }
}

export const compactPlanValidator = new CompactPlanValidator();