import { Router } from "express";
import { z } from "zod";
import { requireSupabase } from "../config/supabase.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

export const accountRouter = Router();
accountRouter.use(requireAuth);

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  avatarPath: z.string().max(512).nullable().optional(),
});

const preferencesSchema = z.object({
  country: z.string().max(80).nullable().optional(),
  timezone: z.string().max(100).nullable().optional(),
  dawPreference: z.string().max(80).nullable().optional(),
  pluginPreference: z.string().max(80).nullable().optional(),
  theme: z.enum(["dark", "system"]).optional(),
  language: z.string().min(2).max(8).optional(),
  defaultBpm: z.number().int().min(40).max(240).optional(),
  defaultKey: z.string().max(24).optional(),
  defaultGenre: z.string().max(80).nullable().optional(),
  autoSave: z.boolean().optional(),
  autosaveIntervalSeconds: z.number().int().min(10).max(600).optional(),
  promptHistoryEnabled: z.boolean().optional(),
  notificationSettings: z.record(z.string(), z.boolean()).optional(),
});

const supportTicketSchema = z.object({
  subject: z.string().trim().min(4).max(160),
  message: z.string().trim().min(10).max(4000),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
});

const supportMessageSchema = z.object({
  body: z.string().trim().min(2).max(4000),
});

accountRouter.get("/profile", async (request: AuthRequest, response, next) => {
  try {
    const db = requireSupabase();
    const { error: profileError } = await db
      .from("profiles")
      .upsert({ id: request.user!.id }, { onConflict: "id", ignoreDuplicates: true });
    if (profileError) throw profileError;

    const { data, error } = await db
      .from("profiles")
      .select("*, user_preferences(*)")
      .eq("id", request.user!.id)
      .single();
    if (error) throw error;
    response.json({ data });
  } catch (error) {
    next(error);
  }
});

accountRouter.patch("/profile", async (request: AuthRequest, response, next) => {
  try {
    const body = profileSchema.parse(request.body);
    const { data, error } = await requireSupabase()
      .from("profiles")
      .upsert({
        id: request.user!.id,
        display_name: body.displayName,
        avatar_path: body.avatarPath ?? null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    response.json({ data });
  } catch (error) {
    next(error);
  }
});

accountRouter.patch("/preferences", async (request: AuthRequest, response, next) => {
  try {
    const body = preferencesSchema.parse(request.body);
    const payload = {
      user_id: request.user!.id,
      ...(body.country !== undefined ? { country: body.country } : {}),
      ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
      ...(body.dawPreference !== undefined ? { daw_preference: body.dawPreference } : {}),
      ...(body.pluginPreference !== undefined ? { plugin_preference: body.pluginPreference } : {}),
      ...(body.theme !== undefined ? { theme: body.theme } : {}),
      ...(body.language !== undefined ? { language: body.language } : {}),
      ...(body.defaultBpm !== undefined ? { default_bpm: body.defaultBpm } : {}),
      ...(body.defaultKey !== undefined ? { default_key: body.defaultKey } : {}),
      ...(body.defaultGenre !== undefined ? { default_genre: body.defaultGenre } : {}),
      ...(body.autoSave !== undefined ? { auto_save: body.autoSave } : {}),
      ...(body.autosaveIntervalSeconds !== undefined ? { autosave_interval_seconds: body.autosaveIntervalSeconds } : {}),
      ...(body.promptHistoryEnabled !== undefined ? { prompt_history_enabled: body.promptHistoryEnabled } : {}),
      ...(body.notificationSettings !== undefined ? { notification_settings: body.notificationSettings } : {}),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await requireSupabase().from("user_preferences").upsert(payload).select().single();
    if (error) throw error;
    response.json({ data });
  } catch (error) {
    next(error);
  }
});

accountRouter.get("/support/tickets", async (request: AuthRequest, response, next) => {
  try {
    const { data, error } = await requireSupabase()
      .from("support_tickets")
      .select("*, support_messages(id, body, author_id, created_at)")
      .eq("user_id", request.user!.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    response.json({ data: data ?? [] });
  } catch (error) {
    next(error);
  }
});

accountRouter.get("/support/tickets/:ticketId", async (request: AuthRequest, response, next) => {
  try {
    const { data, error } = await requireSupabase()
      .from("support_tickets")
      .select("*, support_messages(id, body, author_id, created_at)")
      .eq("id", request.params.ticketId)
      .eq("user_id", request.user!.id)
      .single();
    if (error || !data) return response.status(404).json({ error: "Support ticket not found" });
    response.json({ data });
  } catch (error) {
    next(error);
  }
});

accountRouter.post("/support/tickets", async (request: AuthRequest, response, next) => {
  try {
    const body = supportTicketSchema.parse(request.body);
    const db = requireSupabase();
    const { data: ticket, error: ticketError } = await db
      .from("support_tickets")
      .insert({
        user_id: request.user!.id,
        subject: body.subject,
        priority: body.priority,
        status: "open",
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (ticketError || !ticket) throw ticketError ?? new Error("Unable to create support ticket");

    const { error: messageError } = await db.from("support_messages").insert({
      ticket_id: ticket.id,
      author_id: request.user!.id,
      body: body.message,
    });
    if (messageError) throw messageError;

    await db.from("activity_log").insert({
      user_id: request.user!.id,
      action: "created",
      entity_type: "support_ticket",
      entity_id: ticket.id,
      metadata: { subject: body.subject, priority: body.priority },
    });

    response.status(201).json({ data: ticket });
  } catch (error) {
    next(error);
  }
});

accountRouter.post("/support/tickets/:ticketId/messages", async (request: AuthRequest, response, next) => {
  try {
    const body = supportMessageSchema.parse(request.body);
    const db = requireSupabase();
    const { data: ticket, error: ticketError } = await db
      .from("support_tickets")
      .select("id")
      .eq("id", request.params.ticketId)
      .eq("user_id", request.user!.id)
      .single();
    if (ticketError || !ticket) return response.status(404).json({ error: "Support ticket not found" });

    const { data, error } = await db
      .from("support_messages")
      .insert({
        ticket_id: ticket.id,
        author_id: request.user!.id,
        body: body.body,
      })
      .select()
      .single();
    if (error) throw error;

    await db
      .from("support_tickets")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", ticket.id)
      .eq("user_id", request.user!.id);

    response.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});
