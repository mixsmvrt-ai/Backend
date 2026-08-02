import { aiCompositionSchema } from "./types.js";
import { jsonValidator } from "./jsonValidator.js";
import { AiOrchestrationError, type AiComposition } from "./types.js";

export class ResponseValidator {
  validate(content: string): { response: AiComposition; repaired: boolean } {
    const { value, repaired } = jsonValidator.parse(content);
    const parsed = aiCompositionSchema.safeParse(value);
    if (!parsed.success) {
      throw new AiOrchestrationError(`AI response failed schema validation: ${parsed.error.issues[0]?.message ?? "invalid output"}`, "AI_SCHEMA_VALIDATION_FAILED", 502, true);
    }
    return { response: parsed.data, repaired };
  }
}

export const responseValidator = new ResponseValidator();