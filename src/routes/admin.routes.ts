import { Router } from "express";
import { z } from "zod";
import { requireSupabase } from "../config/supabase.js";
import { requireAdmin, requireAuth, type AuthRequest } from "../middleware/auth.js";
import { auditAdmin } from "../services/admin-audit.service.js";
import * as billing from "../controllers/billing.controller.js";
import * as referral from "../controllers/referral.controller.js";
import * as songPack from "../controllers/songPack.controller.js";
import { usageTracker } from "../services/ai/usageTracker.js";
import { loadOrchestratorSettings } from "../services/aiOrchestrator/settings.js";
import { env } from "../config/env.js";
import { artistKnowledgeRefreshService } from "../services/artistKnowledgeRefresh.service.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);
const tables = { coupons: "coupon_codes", announcements: "announcements", templates: "templates", plugins: "plugin_library", settings: "system_settings", payments: "payments", generations: "generations", projects: "projects", downloads: "downloads", storageFiles: "storage_files", voiceUploads: "voice_uploads", apiKeys: "api_keys", supportTickets: "support_tickets", emails: "email_campaigns", reports: "reports", songPacks: "song_packs", songPackParts: "song_pack_parts", songPackGenerations: "song_pack_generations", creditTransactions: "credit_transactions", genres: "genres", genreProfiles: "genre_profiles", moods: "moods", scales: "scales", keys: "keys", timeSignatures: "time_signatures", tempoRanges: "tempo_ranges", instrumentCategories: "instrument_categories", instrumentRecommendations: "instrument_recommendations", pluginCategories: "plugin_categories", pluginRecommendations: "plugin_recommendations", genreChords: "genre_chords", genreStructures: "genre_structures", genreEnergy: "genre_energy", genreInstruments: "genre_instruments", genrePlugins: "genre_plugins", musicRules: "music_rules", artistProfiles: "artist_profiles", artistCharacteristics: "artist_characteristics", artistGenres: "artist_genres", artistInstruments: "artist_instruments", artistMoods: "artist_moods", artistTempoRanges: "artist_tempo_ranges", artistEnergyProfiles: "artist_energy_profiles", artistTranslationLogs: "artist_translation_logs", artistSongs: "artist_songs", artistStyleFeatures: "artist_style_features", genreStyleFeatures: "genre_style_features", artistGenreProfiles: "artist_genre_profiles", artistReferenceWeights: "artist_reference_weights", songFeatureAnalysis: "song_feature_analysis", referenceMidiMetadata: "reference_midi_metadata", knowledgeSources: "knowledge_sources", knowledgeUpdates: "knowledge_updates", songHarmonicAnalysis: "song_harmonic_analysis", songMelodicAnalysis: "song_melodic_analysis", songRhythmicAnalysis: "song_rhythmic_analysis", artistInstrumentMappings: "artist_instrument_mappings", knowledgeAttributeEvidence: "knowledge_attribute_evidence", knowledgeRefreshJobs: "knowledge_refresh_jobs", knowledgeVersions: "knowledge_versions" } as const;
type Resource = keyof typeof tables;
function table(name: string): Resource { if (!(name in tables)) throw new Error("Unsupported admin resource"); return name as Resource; }
const param = (value: string | string[]) => Array.isArray(value) ? value[0] : value;
const adminSupportStatusSchema = z.object({ status: z.enum(["open", "pending", "resolved"]).optional(), assignedTo: z.string().uuid().nullable().optional() }).refine((input) => input.status !== undefined || input.assignedTo !== undefined, "At least one ticket field is required");
const adminSupportMessageSchema = z.object({ body: z.string().trim().min(1).max(10000) });

async function enrichSupportTickets(tickets: Array<Record<string, any>>) {
	const db = requireSupabase();
	const userIds = [...new Set(tickets.map((ticket) => String(ticket.user_id)))];
	const { data: profiles, error: profilesError } = userIds.length ? await db.from("profiles").select("id, display_name").in("id", userIds) : { data: [], error: null };
	if (profilesError) throw profilesError;
	const profileById = new Map((profiles ?? []).map((profile) => [String(profile.id), profile]));
	return Promise.all(tickets.map(async (ticket) => {
		const userId = String(ticket.user_id);
		const authUser = await db.auth.admin.getUserById(userId);
		if (authUser.error) throw authUser.error;
		const messages = [...((ticket.support_messages ?? []) as Array<Record<string, unknown>>)].sort((left, right) => String(left.created_at).localeCompare(String(right.created_at)));
		const latestMessage = messages[messages.length - 1];
		const unread = Boolean(latestMessage && String(latestMessage.author_id) === userId && (!ticket.admin_read_at || String(ticket.admin_read_at) < String(latestMessage.created_at)));
		return { ...ticket, support_messages: messages, unread, sender: { id: userId, name: profileById.get(userId)?.display_name ?? authUser.data.user?.email ?? "Unknown customer", email: authUser.data.user?.email ?? null } };
	}));
}

adminRouter.get("/overview", async (_request, response, next) => { try { const db = requireSupabase(); const [users, trial, pro, expired, payments, generations, storage, tickets] = await Promise.all([db.from("profiles").select("id", { count: "exact", head: true }), db.from("profiles").select("id", { count: "exact", head: true }).eq("membership_status", "trial_active"), db.from("profiles").select("id", { count: "exact", head: true }).eq("membership_status", "pro_active"), db.from("profiles").select("id", { count: "exact", head: true }).eq("membership_status", "expired"), db.from("payments").select("amount_cents").eq("status", "completed"), db.from("generations").select("id", { count: "exact", head: true }), db.from("storage_files").select("size_bytes"), db.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "pending"])]); [users, trial, pro, expired, payments, generations, storage, tickets].forEach(({ error }) => { if (error) throw error; }); response.json({ data: { totalUsers: users.count ?? 0, trialUsers: trial.count ?? 0, proUsers: pro.count ?? 0, expiredUsers: expired.count ?? 0, revenueCents: (payments.data ?? []).reduce((sum, payment) => sum + payment.amount_cents, 0), totalGenerations: generations.count ?? 0, storageBytes: (storage.data ?? []).reduce((sum, file) => sum + Number(file.size_bytes), 0), openTickets: tickets.count ?? 0 } }); } catch (error) { next(error); } });
adminRouter.get("/support/unread-count", async (_request, response, next) => { try { const { data, error } = await requireSupabase().from("support_tickets").select("id, user_id, admin_read_at, support_messages(author_id, created_at)").in("status", ["open", "pending"]); if (error) throw error; const unread = (data ?? []).filter((ticket) => { const messages = [...(ticket.support_messages ?? [])].sort((left, right) => String(left.created_at).localeCompare(String(right.created_at))); const latest = messages[messages.length - 1]; return Boolean(latest && String(latest.author_id) === String(ticket.user_id) && (!ticket.admin_read_at || String(ticket.admin_read_at) < String(latest.created_at))); }).length; response.json({ data: { unread } }); } catch (error) { next(error); } });
adminRouter.get("/support/tickets", async (_request, response, next) => { try { const { data, error } = await requireSupabase().from("support_tickets").select("*, support_messages(id, body, author_id, created_at)").order("updated_at", { ascending: false }).limit(100); if (error) throw error; response.json({ data: await enrichSupportTickets((data ?? []) as Array<Record<string, any>>) }); } catch (error) { next(error); } });
adminRouter.get("/support/tickets/:ticketId", async (request, response, next) => { try { const ticketId = param(request.params.ticketId); const { data, error } = await requireSupabase().from("support_tickets").select("*, support_messages(id, body, author_id, created_at)").eq("id", ticketId).single(); if (error || !data) return response.status(404).json({ error: "Support ticket not found" }); const [ticket] = await enrichSupportTickets([data as Record<string, any>]); await requireSupabase().from("support_tickets").update({ admin_read_at: new Date().toISOString() }).eq("id", ticketId); response.json({ data: { ...ticket, unread: false } }); } catch (error) { next(error); } });
adminRouter.patch("/support/tickets/:ticketId", async (request: AuthRequest, response, next) => { try { const ticketId = param(request.params.ticketId); const input = adminSupportStatusSchema.parse(request.body); const updates = { ...(input.status !== undefined ? { status: input.status } : {}), ...(input.assignedTo !== undefined ? { assigned_to: input.assignedTo } : {}), updated_at: new Date().toISOString() }; const { data, error } = await requireSupabase().from("support_tickets").update(updates).eq("id", ticketId).select().single(); if (error || !data) return response.status(404).json({ error: "Support ticket not found" }); await auditAdmin(request.user!.id, "updated", "support_ticket", ticketId, input); response.json({ data }); } catch (error) { next(error); } });
adminRouter.post("/support/tickets/:ticketId/messages", async (request: AuthRequest, response, next) => { try { const ticketId = param(request.params.ticketId); const input = adminSupportMessageSchema.parse(request.body); const db = requireSupabase(); const { data: ticket, error: ticketError } = await db.from("support_tickets").select("id").eq("id", ticketId).single(); if (ticketError || !ticket) return response.status(404).json({ error: "Support ticket not found" }); const { data, error } = await db.from("support_messages").insert({ ticket_id: ticket.id, author_id: request.user!.id, body: input.body }).select().single(); if (error) throw error; await db.from("support_tickets").update({ status: "pending", updated_at: new Date().toISOString(), admin_read_at: new Date().toISOString() }).eq("id", ticket.id); await auditAdmin(request.user!.id, "replied", "support_ticket", ticket.id, { bodyLength: input.body.length }); response.status(201).json({ data }); } catch (error) { next(error); } });
adminRouter.get("/users", async (request, response, next) => {
	try {
		const db = requireSupabase();
		const q = String(request.query.query ?? "");
		let query = db.from("profiles").select("*", { count: "exact" }).limit(100).order("created_at", { ascending: false });
		if (q) query = query.ilike("display_name", `%${q}%`);
		const { data, count, error } = await query;
		if (error) throw error;
		const userIds = (data ?? []).map((user) => user.id);
		const { data: roles, error: rolesError } = userIds.length
			? await db.from("user_roles").select("user_id, role").in("user_id", userIds)
			: { data: [], error: null };
		if (rolesError) throw rolesError;
		const rolesByUser = new Map((roles ?? []).map((entry) => [entry.user_id, [{ role: entry.role }]]));
		response.json({ data: (data ?? []).map((user) => ({ ...user, user_roles: rolesByUser.get(user.id) ?? [] })), meta: { total: count ?? 0 } });
	} catch (error) {
		next(error);
	}
});
adminRouter.patch("/users/:id", async (request: AuthRequest, response, next) => { try { const userId = param(request.params.id); const input = z.object({ displayName: z.string().min(1).max(80).optional(), membershipType: z.enum(["trial", "pro", "expired", "admin"]).optional(), membershipStatus: z.enum(["trial_active", "pro_active", "expired", "admin"]).optional(), accessExpiresAt: z.string().datetime().nullable().optional(), trialExpiresAt: z.string().datetime().nullable().optional(), role: z.enum(["user", "support", "admin", "super_admin"]).optional() }).parse(request.body); const db = requireSupabase(); const { error } = await db.from("profiles").update({ ...(input.displayName ? { display_name: input.displayName } : {}), ...(input.membershipType ? { membership_type: input.membershipType } : {}), ...(input.membershipStatus ? { membership_status: input.membershipStatus } : {}), ...(input.accessExpiresAt !== undefined ? { access_expires_at: input.accessExpiresAt } : {}), ...(input.trialExpiresAt !== undefined ? { trial_expires_at: input.trialExpiresAt } : {}) }).eq("id", userId); if (error) throw error; if (input.role) { const { error: roleError } = await db.from("user_roles").upsert({ user_id: userId, role: input.role }); if (roleError) throw roleError; } await auditAdmin(request.user!.id, "updated", "user", userId, input); response.status(204).end(); } catch (error) { next(error); } });
adminRouter.get("/memberships/overview", billing.adminTrialOverview);
adminRouter.get("/memberships/users", billing.adminTrialUsers);
adminRouter.post("/memberships/:userId/convert", billing.adminConvertUser);
adminRouter.post("/memberships/:userId/extend-trial", billing.adminExtendTrial);
adminRouter.post("/memberships/:userId/end-trial", billing.adminEndTrial);
adminRouter.get("/referrals/overview", referral.adminOverview);
adminRouter.get("/referrals", referral.adminReferrerList);
adminRouter.get("/referrals/commissions", referral.adminCommissionList);
adminRouter.get("/referrals/payouts", referral.adminPayoutRequestList);
adminRouter.get("/referrals/payout-history", referral.adminPayoutHistoryList);
adminRouter.get("/referrals/settings", referral.adminSettingsGet);
adminRouter.post("/referrals/payouts/approve", referral.adminApprovePayout);
adminRouter.post("/referrals/payouts/reject", referral.adminRejectPayout);
adminRouter.post("/referrals/settings", referral.adminSettings);
adminRouter.post("/knowledge/refresh", async (request: AuthRequest, response, next) => { try { const data = await artistKnowledgeRefreshService.requestRefresh(request.user!.id, request.body); response.status(202).json({ data }); } catch (error) { next(error); } });
adminRouter.patch("/knowledge/updates/:id/review", async (request: AuthRequest, response, next) => { try { const data = await artistKnowledgeRefreshService.reviewUpdate(param(request.params.id), request.user!.id, request.body); response.json({ data }); } catch (error) { next(error); } });
adminRouter.get("/ai-orchestrator/overview", async (_request, response, next) => { try { const [overview, settings] = await Promise.all([usageTracker.adminOverview(), loadOrchestratorSettings()]); const estimatedLegacyTokens = overview.dailyRequests * settings.baselineLegacyTokensPerRequest; response.json({ data: { ...overview, estimatedLegacyTokens, estimatedTokenSavings: Math.max(0, estimatedLegacyTokens - overview.totalTokens), settings } }); } catch (error) { next(error); } });
adminRouter.get("/song-packs/overview", songPack.adminOverview);
adminRouter.get("/midi-library", async (_request, response, next) => { try { const { data, error } = await requireSupabase().storage.from(env.REFERENCE_MIDI_BUCKET).list("", { limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" } }); if (error) throw error; response.json({ data: (data ?? []).map((file) => ({ name: file.name, updated_at: file.updated_at, created_at: file.created_at, metadata: file.metadata, id: file.id })) }); } catch (error) { next(error); } });
adminRouter.get("/logs/audit", async (_request, response, next) => { try { const { data, error } = await requireSupabase().from("admin_logs").select("*").order("created_at", { ascending: false }).limit(200); if (error) throw error; response.json({ data }); } catch (error) { next(error); } });
adminRouter.get("/:resource", async (request, response, next) => { try { const name = table(param(request.params.resource)); const { data, error } = await requireSupabase().from(tables[name]).select("*").limit(100); if (error) throw error; response.json({ data }); } catch (error) { next(error); } });
adminRouter.post("/:resource", async (request: AuthRequest, response, next) => { try { const name = table(param(request.params.resource)); const { data, error } = await requireSupabase().from(tables[name]).insert(request.body).select().single(); if (error) throw error; await auditAdmin(request.user!.id, "created", name, String(data.id ?? data.key), request.body); response.status(201).json({ data }); } catch (error) { next(error); } });
adminRouter.patch("/:resource/:id", async (request: AuthRequest, response, next) => { try { const name = table(param(request.params.resource)); const id = param(request.params.id); const column = name === "settings" ? "key" : "id"; const { data, error } = await requireSupabase().from(tables[name]).update(request.body).eq(column, id).select().single(); if (error) throw error; await auditAdmin(request.user!.id, "updated", name, id, request.body); response.json({ data }); } catch (error) { next(error); } });
adminRouter.delete("/:resource/:id", async (request: AuthRequest, response, next) => { try { const name = table(param(request.params.resource)); const id = param(request.params.id); const column = name === "settings" ? "key" : "id"; const { error } = await requireSupabase().from(tables[name]).delete().eq(column, id); if (error) throw error; await auditAdmin(request.user!.id, "deleted", name, id); response.status(204).end(); } catch (error) { next(error); } });
