import { jsonValidator } from "../ai/jsonValidator.js";
import { AiOrchestrationError } from "../ai/types.js";
import { normalizeCompactPlan } from "./types.js";

export class CompactPlanValidator {
  validate(content: string, expectedBars?: number) {
    const { value, repaired } = jsonValidator.parse(content);
    try {
      const plan = normalizeCompactPlan(value);
      if (expectedBars !== undefined && plan.bars !== expectedBars) {
        throw new Error(`Expected exactly ${expectedBars} bars, received ${plan.bars}.`);
      }
      return { plan, repaired };
    } catch (error) {
      throw new AiOrchestrationError(error instanceof Error ? `Compact plan failed validation: ${error.message}` : "Compact plan failed validation.", "AI_COMPACT_SCHEMA_VALIDATION_FAILED", 502, true);
    }
  }
}

export const compactPlanValidator = new CompactPlanValidator();