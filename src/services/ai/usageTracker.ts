import { requireSupabase } from "../../config/supabase.js";
import { AiOrchestrationError, type AiGenerateInput, type AiProviderUsage, type AiRequestRecord, type AiRequestRepository, type AiRequestStatus, type AiResponsePayload } from "./types.js";

type RequestRow = {
  id: string;
  user_id: string;
  prompt_hash: string;
  model: string;
  fallback_model: string | null;
  request_payload: AiGenerateInput;
  response_payload: AiResponsePayload | null;
  status: AiRequestStatus;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  response_time_ms: number | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

function mapRequest(row: RequestRow): AiRequestRecord {
  return {
    id: row.id,
    userId: row.user_id,
    promptHash: row.prompt_hash,
    model: row.model,
    fallbackModel: row.fallback_model,
    requestPayload: row.request_payload,
    responsePayload: row.response_payload,
    status: row.status,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    totalTokens: row.total_tokens,
    responseTimeMs: row.response_time_ms,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class UsageTracker implements AiRequestRepository {
  async createRequest(userId: string, promptHash: string, model: string, fallbackModel: string | null, input: AiGenerateInput): Promise<AiRequestRecord> {
    const { data, error } = await requireSupabase().from("ai_requests").insert({
      user_id: userId,
      prompt_hash: promptHash,
      model,
      fallback_model: fallbackModel,
      request_payload: input,
      status: "processing",
    }).select("*").single();
    if (error || !data) throw new AiOrchestrationError(`Unable to create AI request log: ${error?.message ?? "unknown error"}`, "AI_REQUEST_LOG_CREATE_FAILED", 502);
    return mapRequest(data as RequestRow);
  }

  async completeRequest(requestId: string, output: { model: string; response: AiResponsePayload; usage: AiProviderUsage; responseTimeMs: number; status?: AiRequestStatus }): Promise<AiRequestRecord> {
    const db = requireSupabase();
    const { data, error } = await db.from("ai_requests").update({
      model: output.model,
      response_payload: output.response,
      status: output.status ?? "completed",
      prompt_tokens: output.usage.promptTokens,
      completion_tokens: output.usage.completionTokens,
      total_tokens: output.usage.totalTokens,
      response_time_ms: output.responseTimeMs,
      error_code: null,
      error_message: null,
      updated_at: new Date().toISOString(),
    }).eq("id", requestId).select("*").single();
    if (error || !data) throw new AiOrchestrationError(`Unable to update AI request log: ${error?.message ?? "unknown error"}`, "AI_REQUEST_LOG_UPDATE_FAILED", 502);

    const request = mapRequest(data as RequestRow);
    await this.rollupUsage(request.userId, request.model, output.usage, output.responseTimeMs, false);
    await db.from("ai_model_logs").insert({ user_id: request.userId, request_id: request.id, model: request.model, response_time_ms: output.responseTimeMs, total_tokens: output.usage.totalTokens, fallback_used: request.fallbackModel !== null && request.model === request.fallbackModel, error_code: null });
    return request;
  }

  async failRequest(requestId: string, errorInput: { code: string; message: string; responseTimeMs?: number; status?: AiRequestStatus }): Promise<AiRequestRecord> {
    const db = requireSupabase();
    const { data, error } = await db.from("ai_requests").update({
      status: errorInput.status ?? "failed",
      error_code: errorInput.code,
      error_message: errorInput.message,
      response_time_ms: errorInput.responseTimeMs ?? null,
      updated_at: new Date().toISOString(),
    }).eq("id", requestId).select("*").single();
    if (error || !data) throw new AiOrchestrationError(`Unable to update failed AI request: ${error?.message ?? "unknown error"}`, "AI_REQUEST_LOG_UPDATE_FAILED", 502);
    const request = mapRequest(data as RequestRow);
    await this.rollupUsage(request.userId, request.model, { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, errorInput.responseTimeMs ?? 0, true);
    await db.from("ai_errors").insert({ user_id: request.userId, request_id: request.id, code: errorInput.code, message: errorInput.message, model: request.model });
    await db.from("ai_model_logs").insert({ user_id: request.userId, request_id: request.id, model: request.model, response_time_ms: errorInput.responseTimeMs ?? 0, total_tokens: 0, fallback_used: false, error_code: errorInput.code });
    return request;
  }

  async history(userId: string): Promise<AiRequestRecord[]> {
    const { data, error } = await requireSupabase().from("ai_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
    if (error) throw new AiOrchestrationError(`Unable to load AI history: ${error.message}`, "AI_HISTORY_READ_FAILED", 502);
    return (data ?? []).map((row) => mapRequest(row as RequestRow));
  }

  async byId(userId: string, requestId: string): Promise<AiRequestRecord> {
    const { data, error } = await requireSupabase().from("ai_requests").select("*").eq("user_id", userId).eq("id", requestId).single();
    if (error || !data) throw new AiOrchestrationError("AI request not found.", "AI_REQUEST_NOT_FOUND", 404);
    return mapRequest(data as RequestRow);
  }

  async usage(userId: string) {
    const { data, error } = await requireSupabase().from("ai_usage").select("usage_date,requests,prompt_tokens,completion_tokens,total_tokens,average_response_ms,errors").eq("user_id", userId).order("usage_date", { ascending: false }).limit(30);
    if (error) throw new AiOrchestrationError(`Unable to load AI usage: ${error.message}`, "AI_USAGE_READ_FAILED", 502);
    return (data ?? []).map((row) => ({
      date: row.usage_date,
      requests: Number(row.requests),
      promptTokens: Number(row.prompt_tokens),
      completionTokens: Number(row.completion_tokens),
      totalTokens: Number(row.total_tokens),
      averageResponseMs: Number(row.average_response_ms),
      errors: Number(row.errors),
    }));
  }

  async adminOverview() {
    const today = new Date().toISOString().slice(0, 10);
    const db = requireSupabase();
    const [usageRows, modelRows] = await Promise.all([
      db.from("ai_usage").select("user_id,requests,total_tokens,average_response_ms,errors").eq("usage_date", today),
      db.from("ai_model_logs").select("model,response_time_ms,error_code,fallback_used").gte("created_at", `${today}T00:00:00.000Z`),
    ]);
    if (usageRows.error) throw new AiOrchestrationError(`Unable to load AI admin usage: ${usageRows.error.message}`, "AI_ADMIN_READ_FAILED", 502);
    if (modelRows.error) throw new AiOrchestrationError(`Unable to load AI admin model stats: ${modelRows.error.message}`, "AI_ADMIN_READ_FAILED", 502);

    const usageData = usageRows.data ?? [];
    const modelData = modelRows.data ?? [];
    const totalRequests = usageData.reduce((sum, row) => sum + Number(row.requests), 0);
    const totalErrors = usageData.reduce((sum, row) => sum + Number(row.errors), 0);
    const averageResponseTimeMs = usageData.length === 0 ? 0 : usageData.reduce((sum, row) => sum + Number(row.average_response_ms), 0) / usageData.length;
    const topUsers = usageData
      .map((row) => ({ userId: row.user_id, requests: Number(row.requests), totalTokens: Number(row.total_tokens) }))
      .sort((left, right) => right.requests - left.requests)
      .slice(0, 10);
    const byModel = new Map<string, Array<{ response_time_ms: number; error_code: string | null; fallback_used: boolean }>>();
    for (const row of modelData) {
      const list = byModel.get(row.model) ?? [];
      list.push({ response_time_ms: Number(row.response_time_ms), error_code: row.error_code, fallback_used: Boolean(row.fallback_used) });
      byModel.set(row.model, list);
    }
    const modelStats = [...byModel.entries()].map(([model, rows]) => ({
      model,
      requests: rows.length,
      averageResponseTimeMs: rows.reduce((sum, row) => sum + row.response_time_ms, 0) / Math.max(rows.length, 1),
      errors: rows.filter((row) => row.error_code).length,
      fallbacks: rows.filter((row) => row.fallback_used).length,
    }));
    const averageTokensPerGeneration = totalRequests === 0 ? 0 : usageData.reduce((sum, row) => sum + Number(row.total_tokens), 0) / totalRequests;
    const estimatedLegacyTokens = totalRequests * 3200;
    const totalTokens = usageData.reduce((sum, row) => sum + Number(row.total_tokens), 0);
    return {
      dailyRequests: totalRequests,
      averageTokensPerGeneration: Number(averageTokensPerGeneration.toFixed(2)),
      totalTokens,
      estimatedLegacyTokens,
      estimatedTokenSavings: Math.max(0, estimatedLegacyTokens - totalTokens),
      averageResponseTimeMs: Number(averageResponseTimeMs.toFixed(2)),
      errorRate: totalRequests === 0 ? 0 : Number((totalErrors / totalRequests).toFixed(3)),
      topUsers,
      modelStats,
    };
  }

  private async rollupUsage(userId: string, model: string, usage: AiProviderUsage, responseTimeMs: number, errored: boolean) {
    const today = new Date().toISOString().slice(0, 10);
    const db = requireSupabase();
    const { data: current, error: currentError } = await db.from("ai_usage").select("requests,prompt_tokens,completion_tokens,total_tokens,average_response_ms,errors").eq("user_id", userId).eq("usage_date", today).maybeSingle();
    if (currentError) throw new AiOrchestrationError(`Unable to roll up AI usage: ${currentError.message}`, "AI_USAGE_WRITE_FAILED", 502);
    const nextRequests = Number(current?.requests ?? 0) + 1;
    const previousAverage = Number(current?.average_response_ms ?? 0);
    const nextAverage = nextRequests === 1 ? responseTimeMs : ((previousAverage * (nextRequests - 1)) + responseTimeMs) / nextRequests;
    const { error } = await db.from("ai_usage").upsert({
      user_id: userId,
      usage_date: today,
      model,
      requests: nextRequests,
      prompt_tokens: Number(current?.prompt_tokens ?? 0) + usage.promptTokens,
      completion_tokens: Number(current?.completion_tokens ?? 0) + usage.completionTokens,
      total_tokens: Number(current?.total_tokens ?? 0) + usage.totalTokens,
      average_response_ms: Number(nextAverage.toFixed(2)),
      errors: Number(current?.errors ?? 0) + (errored ? 1 : 0),
    });
    if (error) throw new AiOrchestrationError(`Unable to write AI usage: ${error.message}`, "AI_USAGE_WRITE_FAILED", 502);
  }
}

export const usageTracker = new UsageTracker();