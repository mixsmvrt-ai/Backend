import { AiOrchestrationError } from "./types.js";

function stripCodeFences(value: string) {
  return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function extractObject(value: string) {
  const first = value.indexOf("{");
  const last = value.lastIndexOf("}");
  if (first >= 0 && last > first) {
    return value.slice(first, last + 1);
  }
  return value;
}

function repairJson(value: string) {
  return value
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/\u0000/g, "")
    .trim();
}

export class JsonValidator {
  parse(content: string) {
    const cleaned = repairJson(extractObject(stripCodeFences(content)));
    try {
      return { value: JSON.parse(cleaned) as unknown, repaired: cleaned !== content.trim() };
    } catch {
      throw new AiOrchestrationError("AI returned malformed JSON.", "AI_MALFORMED_JSON", 502, true);
    }
  }
}

export const jsonValidator = new JsonValidator();