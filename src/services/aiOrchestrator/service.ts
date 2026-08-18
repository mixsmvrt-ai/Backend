import { contextBuilder } from "../ai/contextBuilder.js";
import { fallbackService } from "../ai/fallback.service.js";
import { geminiService } from "../ai/gemini.service.js";
import { modelSelector } from "../ai/modelSelector.js";
import { retryManager } from "../ai/retryManager.js";
import { usageTracker } from "../ai/usageTracker.js";
import { cacheService } from "../ai/cache.service.js";
import { AiOrchestrationError, type AiGenerateInput } from "../ai/types.js";
import { buildCompactPlannerPrompt } from "./promptBuilder.js";
import { loadOrchestratorSettings } from "./settings.js";
import { compactPlanValidator } from "./validator.js";
import type { CompactPlannerResult, PlannerWorkflow } from "./types.js";
import { env } from "../../config/env.js";

type PlannerTrackRequest = { name: string; instrument?: string; role?: string; instruction?: string };

export class CompactAiOrchestratorService {
  async plan(userId: string, input: AiGenerateInput & { workflow?: PlannerWorkflow; requestedTracks?: PlannerTrackRequest[]; forceRefresh?: boolean }): Promise<CompactPlannerResult> {
    const settings = await loadOrchestratorSettings();
    if (!settings.enabled) {
      throw new AiOrchestrationError("AI Orchestrator is disabled.", "AI_ORCHESTRATOR_DISABLED", 503);
    }
    const selection = await modelSelector.forUser(userId);
    const workflow = input.workflow ?? "text_to_midi";
    const bars = workflow === "voice_to_midi" ? Math.max(1, Math.min(input.lengthBars, 128)) : 8;
    const requestedTracks = input.requestedTracks?.length ? input.requestedTracks : [{ name: "Main Melody", role: input.kind, instruction: `Generate a single ${input.kind.replace(/_/g, " ")} track.` }];
    const context = await contextBuilder.build(userId, { ...input, lengthBars: bars, forceRefresh: input.forceRefresh ?? false });
    const assembled = buildCompactPlannerPrompt(context, { workflow, bars, requestedTracks });
    const promptHash = cacheService.key(JSON.stringify({ assembled: assembled.cacheKeyMaterial, model: settings.defaultModel ?? selection.primaryModel, validation: settings.jsonValidationStrictness }));

    if (!input.forceRefresh) {
      const cached = await cacheService.get<import("./types.js").CompactMusicPlan>(promptHash);
      if (cached) {
        return {
          id: `cache-${promptHash.slice(0, 12)}`,
          cached: true,
          model: cached.model,
          fallbackUsed: false,
          promptHash,
          responseTimeMs: 0,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          plan: cached.response,
          tempoAdvisory: context.musicBrain.context.tempoAdvisory?.message ?? null,
        };
      }
    }

    const primaryModel = settings.defaultModel ?? selection.primaryModel;
    const fallbackModel = null;
    const request = await usageTracker.createRequest(userId, promptHash, primaryModel, fallbackModel, { ...input, lengthBars: bars, forceRefresh: input.forceRefresh ?? false });
    const models = fallbackService.sequence({ membership: selection.membership, primaryModel, fallbackModel });
    let fallbackUsed = false;

    try {
      const result = await retryManager.run(async (attempt) => {
        const model = models[Math.min(attempt, models.length - 1)] ?? primaryModel;
        fallbackUsed = model !== primaryModel;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), env.AI_REQUEST_TIMEOUT_MS);
        try {
          const raw = await geminiService.generate(`${assembled.systemPrompt}\n\n${assembled.userPrompt}`, {
            model,
            signal: controller.signal,
            temperature: settings.temperature,
            maxOutputTokens: settings.maxOutputTokens,
          });
          const validated = compactPlanValidator.validate(raw.content, workflow === "voice_to_midi" ? undefined : bars);
          return {
            model: raw.model,
            usage: raw.usage,
            responseTimeMs: raw.responseTimeMs,
            plan: validated.plan,
          };
        } finally {
          clearTimeout(timeout);
        }
      }, (error) => error instanceof AiOrchestrationError && error.retryable);

      await cacheService.put(promptHash, result.plan, result.model, settings.cacheDurationSeconds);
      await usageTracker.completeRequest(request.id, { model: result.model, response: result.plan, usage: result.usage, responseTimeMs: result.responseTimeMs });
      return {
        id: request.id,
        cached: false,
        model: result.model,
        fallbackUsed,
        promptHash,
        responseTimeMs: result.responseTimeMs,
        usage: result.usage,
        plan: result.plan,
        tempoAdvisory: context.musicBrain.context.tempoAdvisory?.message ?? null,
      };
    } catch (error) {
      const aiError = error instanceof AiOrchestrationError ? error : new AiOrchestrationError(error instanceof Error ? error.message : "Compact planning failed", "AI_COMPACT_PLANNING_FAILED", 502, false);
      await usageTracker.failRequest(request.id, { code: aiError.code, message: aiError.message });
      throw aiError;
    }
  }
}

export const compactAiOrchestratorService = new CompactAiOrchestratorService();