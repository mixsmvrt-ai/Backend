import { createHash } from "node:crypto";
import { requireSupabase } from "../../config/supabase.js";
import { env } from "../../config/env.js";
import { DEFAULT_CACHE_TTL_SECONDS } from "./constants.js";
import { AiOrchestrationError, type AiResponsePayload, type CachedAiResponse } from "./types.js";

type CacheRow = {
  key: string;
  response_json: AiResponsePayload;
  model: string;
  expires_at: string;
};

export class CacheService {
  key(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }

  async get<T = AiResponsePayload>(promptHash: string): Promise<(CachedAiResponse & { response: T }) | null> {
    const { data, error } = await requireSupabase().from("ai_cache").select("key,response_json,model,expires_at").eq("key", promptHash).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (error) throw new AiOrchestrationError(`Unable to read AI cache: ${error.message}`, "AI_CACHE_READ_FAILED", 502);
    if (!data) return null;
    const row = data as CacheRow;
    return {
      response: row.response_json,
      model: row.model,
      promptHash: row.key,
      expiresAt: row.expires_at,
    } as CachedAiResponse & { response: T };
  }

  async put(promptHash: string, response: AiResponsePayload, model: string, ttlSeconds = env.AI_CACHE_TTL_SECONDS ?? DEFAULT_CACHE_TTL_SECONDS): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const { error } = await requireSupabase().from("ai_cache").upsert({ key: promptHash, response_json: response, model, expires_at: expiresAt });
    if (error) throw new AiOrchestrationError(`Unable to write AI cache: ${error.message}`, "AI_CACHE_WRITE_FAILED", 502);
  }
}

export const cacheService = new CacheService();