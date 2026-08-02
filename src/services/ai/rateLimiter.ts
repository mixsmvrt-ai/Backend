import { requireSupabase } from "../../config/supabase.js";
import { env } from "../../config/env.js";
import { DEFAULT_FREE_DAILY_LIMIT, DEFAULT_PRO_DAILY_LIMIT } from "./constants.js";
import { AiOrchestrationError, type AiUsageSnapshot, type MembershipTier } from "./types.js";

export class RateLimiter {
  async enforce(userId: string, membership: MembershipTier): Promise<AiUsageSnapshot> {
    const today = new Date().toISOString().slice(0, 10);
    const dailyLimit = membership === "pro" ? (env.AI_PRO_DAILY_LIMIT ?? DEFAULT_PRO_DAILY_LIMIT) : (env.AI_FREE_DAILY_LIMIT ?? DEFAULT_FREE_DAILY_LIMIT);
    const { data, error } = await requireSupabase().from("ai_usage").select("requests").eq("user_id", userId).eq("usage_date", today).maybeSingle();
    if (error) throw new AiOrchestrationError(`Unable to read AI usage limits: ${error.message}`, "AI_USAGE_READ_FAILED", 502);
    const usedToday = Number(data?.requests ?? 0);
    if (usedToday >= dailyLimit) {
      throw new AiOrchestrationError("Daily AI generation limit reached.", "AI_RATE_LIMIT_EXCEEDED", 429);
    }
    return {
      tier: membership,
      dailyLimit,
      usedToday,
      remainingToday: Math.max(0, dailyLimit - usedToday),
    };
  }
}

export const rateLimiter = new RateLimiter();