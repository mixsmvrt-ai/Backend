import { structuredMusicSchema, type StructuredMusic } from "../domain/music.js";
import { AiOrchestrationError } from "../services/ai/types.js";

export interface MusicAiProvider { compose(prompt: string, signal: AbortSignal): Promise<StructuredMusic>; }
export class OpenAiCompatibleProvider implements MusicAiProvider {
  constructor(private readonly baseUrl: string, private readonly apiKey: string, private readonly model: string) {}
  async compose(prompt: string, signal: AbortSignal): Promise<StructuredMusic> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` }, signal, body: JSON.stringify({ model: this.model, response_format: { type: "json_object" }, messages: [{ role: "system", content: "Return valid JSON only. Do not include markdown." }, { role: "user", content: prompt }] }) });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw new AiOrchestrationError("MIDI generation timed out. Please try again.", "AI_TIMEOUT", 504, true);
      throw new AiOrchestrationError(error instanceof Error ? error.message : "AI provider request failed.", "AI_PROVIDER_REQUEST_FAILED", 502, true);
    }
    if (!response.ok) {
      const providerDetail = (await response.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 500);
      console.error("[ai] provider request failed", { status: response.status, model: this.model, detail: providerDetail || "no response body" });
      const temporary = response.status === 429 || response.status >= 500;
      throw new AiOrchestrationError(
        temporary ? "The music generation service is temporarily unavailable. Please try again." : "The music generation request was rejected.",
        temporary ? "AI_PROVIDER_TEMPORARY_FAILURE" : "AI_PROVIDER_REJECTED",
        temporary ? (response.status === 429 ? 429 : 503) : 422,
        temporary,
      );
    }
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new AiOrchestrationError("AI provider returned no structured composition.", "AI_EMPTY_RESPONSE", 502, true);
    try {
      return structuredMusicSchema.parse(JSON.parse(content));
    } catch (error) {
      console.error("[ai] invalid structured composition", { model: this.model, error: error instanceof Error ? error.message : "invalid response" });
      throw new AiOrchestrationError("The music model returned an invalid composition. Please try again.", "AI_INVALID_RESPONSE", 502, true);
    }
  }
}
