import { requireSupabase } from "../../config/supabase.js";
import { env } from "../../config/env.js";
import type { OrchestratorSettings } from "./types.js";

function defaults(): OrchestratorSettings {
  return {
    enabled: true,
    defaultModel: null,
    fallbackModel: null,
    temperature: 0.45,
    maxOutputTokens: 2400,
    jsonValidationStrictness: "strict",
    cacheDurationSeconds: env.AI_CACHE_TTL_SECONDS,
    baselineLegacyTokensPerRequest: 3200,
  };
}

export async function loadOrchestratorSettings(): Promise<OrchestratorSettings> {
  const base = defaults();
  try {
    const { data, error } = await requireSupabase().from("system_settings").select("value").eq("key", "ai_orchestrator_config").maybeSingle();
    if (error || !data?.value) return base;
    const value = data.value as Record<string, unknown>;
    return {
      enabled: typeof value.enabled === "boolean" ? value.enabled : base.enabled,
      defaultModel: typeof value.defaultModel === "string" ? value.defaultModel : base.defaultModel,
      fallbackModel: typeof value.fallbackModel === "string" ? value.fallbackModel : base.fallbackModel,
      temperature: typeof value.temperature === "number" ? value.temperature : base.temperature,
      maxOutputTokens: typeof value.maxOutputTokens === "number" ? value.maxOutputTokens : base.maxOutputTokens,
      jsonValidationStrictness: value.jsonValidationStrictness === "relaxed" ? "relaxed" : "strict",
      cacheDurationSeconds: typeof value.cacheDurationSeconds === "number" ? value.cacheDurationSeconds : base.cacheDurationSeconds,
      baselineLegacyTokensPerRequest: typeof value.baselineLegacyTokensPerRequest === "number" ? value.baselineLegacyTokensPerRequest : base.baselineLegacyTokensPerRequest,
    };
  } catch {
    return base;
  }
}