import type { AiProviderPort, AiProviderResponse } from "./types.js";

export abstract class BaseAiProvider implements AiProviderPort {
  abstract generate(prompt: string, options: { model: string; signal: AbortSignal; temperature?: number; maxOutputTokens?: number }): Promise<AiProviderResponse>;
}