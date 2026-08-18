import { z } from "zod";
import { requireSupabase } from "../config/supabase.js";

const refreshInputSchema = z.object({
  entityType: z.enum(["artist", "song", "genre"]),
  entityId: z.string().uuid(),
  sourceUrls: z.array(z.string().url()).max(20).default([]),
});

const reviewInputSchema = z.object({
  status: z.enum(["verified", "rejected", "needs_review"]),
  proposedPayload: z.record(z.unknown()).optional(),
  sourceUrls: z.array(z.string().url()).max(20).optional(),
});

export class ArtistKnowledgeRefreshService {
  async requestRefresh(userId: string, input: unknown) {
    const parsed = refreshInputSchema.parse(input);
    const { data, error } = await requireSupabase().from("knowledge_refresh_jobs").insert({
      entity_type: parsed.entityType,
      entity_id: parsed.entityId,
      requested_by: userId,
      source_urls: parsed.sourceUrls,
      status: "pending",
    }).select().single();
    if (error) throw error;
    return data;
  }

  async reviewUpdate(updateId: string, reviewerId: string, input: unknown) {
    const parsed = reviewInputSchema.parse(input);
    const db = requireSupabase();
    const { data: update, error: updateError } = await db.from("knowledge_updates").select("*").eq("id", updateId).single();
    if (updateError || !update) throw updateError ?? new Error("Knowledge update not found.");
    const payload = parsed.proposedPayload ?? update.candidate_payload;
    const { data: reviewed, error: reviewError } = await db.from("knowledge_updates").update({ status: parsed.status, candidate_payload: payload, updated_at: new Date().toISOString() }).eq("id", updateId).select().single();
    if (reviewError) throw reviewError;
    if (parsed.status === "verified") {
      const { error: versionError } = await db.from("knowledge_versions").insert({ entity_type: update.entity_type, entity_id: update.entity_id, version: update.version, snapshot: payload, changed_by: reviewerId, change_source: "admin_review" });
      if (versionError) throw versionError;
    }
    return reviewed;
  }
}

export const artistKnowledgeRefreshService = new ArtistKnowledgeRefreshService();