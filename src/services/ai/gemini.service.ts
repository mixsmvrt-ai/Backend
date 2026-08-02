import { env } from "../../config/env.js";
import { BaseAiProvider } from "./provider.js";
import { AiOrchestrationError, type AiProviderResponse, type AiProviderUsage } from "./types.js";

function parseUsage(payload: unknown): AiProviderUsage {
  const usage = payload as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };
  return {
    promptTokens: usage.usage?.prompt_tokens ?? 0,
    completionTokens: usage.usage?.completion_tokens ?? 0,
    totalTokens: usage.usage?.total_tokens ?? ((usage.usage?.prompt_tokens ?? 0) + (usage.usage?.completion_tokens ?? 0)),
  };
}

export class GeminiService extends BaseAiProvider {
  constructor(
    private readonly baseUrl = env.AI_PROVIDER_BASE_URL,
    private readonly apiKey = env.AI_PROVIDER_API_KEY,
  ) {
    super();
  }

  async generate(prompt: string, options: { model: string; signal: AbortSignal; temperature?: number; maxOutputTokens?: number }): Promise<AiProviderResponse> {
    if (!this.baseUrl || !this.apiKey) {
      throw new AiOrchestrationError("AI provider is not configured.", "AI_PROVIDER_NOT_CONFIGURED", 503);
    }
    const startedAt = Date.now();
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      signal: options.signal,
      body: JSON.stringify({
        model: options.model,
        response_format: { type: "json_object" },
        temperature: options.temperature,
        max_tokens: options.maxOutputTokens,
        messages: [
          { role: "system", content: "Return valid JSON only. Do not include markdown, comments, or prose outside the JSON object." },
          { role: "user", content: prompt },
        ],
      }),
    }).catch((error: Error) => {
      if (error.name === "AbortError") {
        throw new AiOrchestrationError("AI request timed out.", "AI_TIMEOUT", 504, true);
      }
      throw new AiOrchestrationError(`AI provider request failed: ${error.message}`, "AI_PROVIDER_REQUEST_FAILED", 502, true);
    });

    if (!response.ok) {
      const message = `AI provider request failed with ${response.status}.`;
      throw new AiOrchestrationError(message, response.status >= 500 ? "AI_PROVIDER_TEMPORARY_FAILURE" : "AI_PROVIDER_REJECTED", response.status >= 500 ? 502 : 422, response.status >= 500);
    }

    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }>; model?: string; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new AiOrchestrationError("AI provider returned no content.", "AI_EMPTY_RESPONSE", 502, true);
    }

    return {
      content,
      model: payload.model ?? options.model,
      usage: parseUsage(payload),
      responseTimeMs: Date.now() - startedAt,
      providerStatus: response.status,
    };
  }
}

export const geminiService = new GeminiService();