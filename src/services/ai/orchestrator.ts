import { env } from "../../config/env.js";
import { cacheService } from "./cache.service.js";
import { contextBuilder } from "./contextBuilder.js";
import { fallbackService } from "./fallback.service.js";
import { geminiService, GeminiService } from "./gemini.service.js";
import { modelSelector, ModelSelector } from "./modelSelector.js";
import { promptAssembler } from "./promptAssembler.js";
import { rateLimiter } from "./rateLimiter.js";
import { responseValidator } from "./responseValidator.js";
import { retryManager } from "./retryManager.js";
import { usageTracker, UsageTracker } from "./usageTracker.js";
import { AiOrchestrationError, type AiGenerateInput, type AiGenerateResult, type AiProviderPort, type AiRequestRepository } from "./types.js";

export class AiOrchestrator {
  constructor(
    private readonly provider: AiProviderPort = geminiService,
    private readonly selector: ModelSelector = modelSelector,
    private readonly tracker: AiRequestRepository = usageTracker,
  ) {}

  async generate(userId: string, input: AiGenerateInput): Promise<AiGenerateResult> {
    const selection = await this.selector.forUser(userId);
    await rateLimiter.enforce(userId, selection.membership);
    const context = await contextBuilder.build(userId, input);
    const assembled = promptAssembler.assemble(input, context);
    const promptHash = cacheService.key(assembled.cacheKeyMaterial);
    if (!input.forceRefresh) {
      const cached = await cacheService.get(promptHash);
      if (cached) {
        return {
          id: `cache-${promptHash.slice(0, 12)}`,
          cached: true,
          model: cached.model,
          fallbackUsed: false,
          response: cached.response,
          tempoAdvisory: context.musicBrain.context.tempoAdvisory?.message ?? null,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          responseTimeMs: 0,
          promptHash,
        };
      }
    }

    const request = await this.tracker.createRequest(userId, promptHash, selection.primaryModel, selection.fallbackModel, input);
    const models = fallbackService.sequence(selection);
    let fallbackUsed = false;
    let currentModel = models[0];

    try {
      const result = await retryManager.run(async (attempt) => {
        const model = models[Math.min(attempt, models.length - 1)];
        fallbackUsed = model !== selection.primaryModel;
        currentModel = model;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), env.AI_REQUEST_TIMEOUT_MS);
        try {
          const raw = await this.provider.generate(assembled.prompt, { model, signal: controller.signal });
          const validated = responseValidator.validate(raw.content);
          return {
            response: validated.response,
            usage: raw.usage,
            model: raw.model,
            responseTimeMs: raw.responseTimeMs,
          };
        } finally {
          clearTimeout(timer);
        }
      }, (error) => error instanceof AiOrchestrationError && error.retryable);

      await cacheService.put(promptHash, result.response, result.model);
      const completed = await this.tracker.completeRequest(request.id, { model: result.model, response: result.response, usage: result.usage, responseTimeMs: result.responseTimeMs });
      return {
        id: completed.id,
        cached: false,
        model: result.model,
        fallbackUsed,
        response: result.response,
        tempoAdvisory: context.musicBrain.context.tempoAdvisory?.message ?? null,
        usage: result.usage,
        responseTimeMs: result.responseTimeMs,
        promptHash,
      };
    } catch (error) {
      const aiError = error instanceof AiOrchestrationError
        ? error
        : new AiOrchestrationError(error instanceof Error ? error.message : "AI generation failed", "AI_GENERATION_FAILED", 502, false);
      await this.tracker.failRequest(request.id, { code: aiError.code, message: aiError.message });
      throw aiError;
    }
  }

  history(userId: string) {
    return this.tracker.history(userId);
  }

  usage(userId: string) {
    return this.tracker.usage(userId);
  }

  async retry(userId: string, requestId: string) {
    const request = await this.tracker.byId(userId, requestId);
    return this.generate(userId, { ...request.requestPayload, forceRefresh: true });
  }

  adminOverview() {
    return this.tracker.adminOverview();
  }
}

export const aiOrchestrator = new AiOrchestrator();