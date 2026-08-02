import { structuredMusicSchema, type StructuredMusic } from "../domain/music.js";

export interface MusicAiProvider { compose(prompt: string, signal: AbortSignal): Promise<StructuredMusic>; }
export class OpenAiCompatibleProvider implements MusicAiProvider {
  constructor(private readonly baseUrl: string, private readonly apiKey: string, private readonly model: string) {}
  async compose(prompt: string, signal: AbortSignal): Promise<StructuredMusic> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` }, signal, body: JSON.stringify({ model: this.model, response_format: { type: "json_object" }, messages: [{ role: "system", content: "Return valid JSON only. Do not include markdown." }, { role: "user", content: prompt }] }) });
    if (!response.ok) throw new Error(`AI provider request failed with ${response.status}.`);
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI provider returned no structured composition.");
    return structuredMusicSchema.parse(JSON.parse(content));
  }
}
