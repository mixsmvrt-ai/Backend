import { describe, expect, it } from "vitest";
import { PromptAssembler } from "./promptAssembler.js";
import type { AiGenerateInput, BuiltAiContext } from "./types.js";

describe("PromptAssembler", () => {
  it("assembles a strict JSON instruction prompt", () => {
    const assembler = new PromptAssembler();
    const input = {
      prompt: "Make a dreamy pop melody",
      kind: "melody",
      lengthBars: 16,
      complexity: "medium",
      variationAmount: 0.5,
      timeSignature: [4, 4],
      pluginSuggestions: false,
      forceRefresh: false,
    } as AiGenerateInput;
    const context = {
      prompt: "Make a dreamy pop melody",
      sanitizedPrompt: "Make a dreamy pop melody",
      musicBrain: { context: {} as never, providerPrompt: "Music Brain prompt" },
      interpretation: null,
      artist: { translatedGenre: "Pop", translatedMood: ["Dreamy"], translatedTempo: 108, translatedInstruments: ["synth"], grooveStyle: "straight", melodyStyle: "hooky", productionStyle: "airy", originalityNotice: "Keep it original", sanitizedPrompt: "Make a dreamy pop melody", knowledgeGenre: "Pop" },
      knowledge: [],
      projectHistory: [],
      userPreferences: undefined,
    } satisfies BuiltAiContext;
    const result = assembler.assemble(input, context);
    expect(result.prompt).toContain("Required JSON schema");
    expect(result.prompt).toContain("melody");
  });
});