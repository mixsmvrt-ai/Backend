import { describe, expect, it } from "vitest";
import { JsonValidator } from "./jsonValidator.js";

describe("JsonValidator", () => {
  it("repairs fenced JSON content", () => {
    const validator = new JsonValidator();
    const result = validator.parse("```json\n{\"foo\":1,}\n```");
    expect(result.value).toEqual({ foo: 1 });
    expect(result.repaired).toBe(true);
  });
});