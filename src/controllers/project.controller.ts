import type { Response } from "express";
import { z } from "zod";
import { requireSupabase } from "../config/supabase.js";
import type { AuthRequest } from "../middleware/auth.js";
import { orchestrateGeneration } from "../services/orchestration.service.js";
import { generateProjectConversationReply } from "../services/projectConversationAi.service.js";
import { orchestrationSchema } from "../domain/music.js";

const projectSchema = z.object({ title: z.string().trim().min(1).max(120), description: z.string().max(2000).default(""), tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]), genre: z.string().max(80).nullable().optional(), bpm: z.number().int().min(40).max(240).nullable().optional(), musicalKey: z.string().max(24).nullable().optional() });
const patchSchema = projectSchema.partial().extend({ isFavorite: z.boolean().optional(), archived: z.boolean().optional() });
const messageSchema = z.object({
	content: z.string().trim().min(1).max(2000),
	generation: z.object({
		kind: z.enum(["melody", "chords", "counter_melody", "bassline", "drums", "full_composition"]).optional(),
		key: z.string().max(12).optional(),
		scale: z.string().max(40).optional(),
		tempo: z.number().int().min(40).max(240).optional(),
		lengthBars: z.number().int().min(1).max(128).default(8),
		complexity: z.enum(["low", "medium", "high"]).default("medium"),
		variationAmount: z.number().min(0).max(1).default(0.5),
		timeSignature: z.tuple([z.number().int().min(1).max(12), z.number().int().min(1).max(16)]).default([4, 4]),
	}).optional(),
});
type ProjectConversationRow = {
	id: string;
	genre: string | null;
	mood: string | null;
	bpm: number | null;
	musical_key: string | null;
};
function failure(response: Response, error: unknown) {
	console.error("[project] message request failed", {
		error: error instanceof Error ? error.message : error,
		code: typeof error === "object" && error !== null && "code" in error ? error.code : undefined,
	});
	const statusCode = typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 500;
	const isExpected = statusCode >= 400 && statusCode < 500;
	return response.status(statusCode).json({ error: isExpected && error instanceof Error ? error.message : "Server error. Please try again in a few minutes." });
}

function looksLikeGenerationRequest(prompt: string) {
	return /\b(generate|create|make|write|compose|produce|add|give me|next)\b/i.test(prompt)
		&& /\b(midi|melody|chord|chords|harmony|bass|bassline|counter|drum|drums|progression|part|variation|layer)\b/i.test(prompt);
}

function inferGenerationKind(prompt: string) {
	if (/\b(chord|chords|harmony|progression)\b/i.test(prompt)) return "chords" as const;
	if (/\b(bass|bassline|808)\b/i.test(prompt)) return "bassline" as const;
	if (/\b(counter|answer)\b/i.test(prompt)) return "counter_melody" as const;
	if (/\b(drum|drums|percussion)\b/i.test(prompt)) return "drums" as const;
	return "melody" as const;
}

export async function read(request: AuthRequest, response: Response) {
	try {
		const db = requireSupabase();
		const { data, error } = await db.from("projects").select("*, project_tags(tag)").eq("id", request.params.projectId).eq("user_id", request.user!.id).is("deleted_at", null).single();
		if (error) return response.status(404).json({ error: "Project not found" });
		response.json({ data });
	} catch (error) {
		return failure(response, error);
	}
}

export async function list(request: AuthRequest, response: Response) { try { const db = requireSupabase(); const page = Math.max(Number(request.query.page ?? 1), 1); const size = Math.min(Math.max(Number(request.query.size ?? 20), 1), 100); const query = String(request.query.query ?? ""); const sort = request.query.sort === "created_at" ? "created_at" : "updated_at"; let builder = db.from("projects").select("*, project_tags(tag)", { count: "exact" }).eq("user_id", request.user!.id).is("deleted_at", null).is("archived_at", null).range((page - 1) * size, page * size - 1).order(sort, { ascending: false }); if (query) builder = builder.ilike("title", `%${query}%`); const { data, count, error } = await builder; if (error) throw error; response.json({ data, meta: { page, size, total: count ?? 0 } }); } catch (error) { return failure(response, error); } }
export async function create(request: AuthRequest, response: Response) { try { const body = projectSchema.parse(request.body); const db = requireSupabase(); const { data, error } = await db.from("projects").insert({ user_id: request.user!.id, title: body.title, description: body.description, genre: body.genre ?? null, bpm: body.bpm ?? null, musical_key: body.musicalKey ?? null }).select().single(); if (error) throw error; if (body.tags.length) { const { error: tagsError } = await db.from("project_tags").insert(body.tags.map((tag) => ({ project_id: data.id, user_id: request.user!.id, tag }))); if (tagsError) throw tagsError; } await db.from("activity_log").insert({ user_id: request.user!.id, action: "created", entity_type: "project", entity_id: data.id }); response.status(201).json({ data }); } catch (error) { return failure(response, error); } }
export async function update(request: AuthRequest, response: Response) { try { const body = patchSchema.parse(request.body); const db = requireSupabase(); const payload = { ...(body.title !== undefined ? { title: body.title } : {}), ...(body.description !== undefined ? { description: body.description } : {}), ...(body.genre !== undefined ? { genre: body.genre } : {}), ...(body.bpm !== undefined ? { bpm: body.bpm } : {}), ...(body.musicalKey !== undefined ? { musical_key: body.musicalKey } : {}), ...(body.isFavorite !== undefined ? { is_favorite: body.isFavorite } : {}), ...(body.archived !== undefined ? { archived_at: body.archived ? new Date().toISOString() : null } : {}), updated_at: new Date().toISOString() }; const { data, error } = await db.from("projects").update(payload).eq("id", request.params.projectId).eq("user_id", request.user!.id).select().single(); if (error) throw error; if (body.tags) { await db.from("project_tags").delete().eq("project_id", data.id).eq("user_id", request.user!.id); const tagsError = body.tags.length ? (await db.from("project_tags").insert(body.tags.map((tag) => ({ project_id: data.id, user_id: request.user!.id, tag })))).error : null; if (tagsError) throw tagsError; } response.json({ data }); } catch (error) { return failure(response, error); } }
export async function remove(request: AuthRequest, response: Response) { try { const db = requireSupabase(); const { error } = await db.from("projects").update({ deleted_at: new Date().toISOString() }).eq("id", request.params.projectId).eq("user_id", request.user!.id); if (error) throw error; response.status(204).end(); } catch (error) { return failure(response, error); } }
export async function duplicate(request: AuthRequest, response: Response) { try { const db = requireSupabase(); const { data: source, error: findError } = await db.from("projects").select("*").eq("id", request.params.projectId).eq("user_id", request.user!.id).is("deleted_at", null).single(); if (findError) throw findError; const { data, error } = await db.from("projects").insert({ user_id: request.user!.id, title: `${source.title} copy`, description: source.description, genre: source.genre, bpm: source.bpm, musical_key: source.musical_key }).select().single(); if (error) throw error;
		const { data: messages, error: messagesError } = await db.from("project_messages").select("role, content, generation_id").eq("project_id", source.id).eq("user_id", request.user!.id).order("created_at", { ascending: true }); if (messagesError) throw messagesError;
		if (messages?.length) { const { error: copyMessagesError } = await db.from("project_messages").insert(messages.map((message) => ({ project_id: data.id, user_id: request.user!.id, role: message.role, content: message.content, generation_id: message.generation_id }))); if (copyMessagesError) throw copyMessagesError; }
		const { data: versions, error: versionsError } = await db.from("project_versions").select("version_number, prompt, parameters, generation_id").eq("project_id", source.id).eq("user_id", request.user!.id).order("version_number", { ascending: true }); if (versionsError) throw versionsError;
		if (versions?.length) { const { error: copyVersionsError } = await db.from("project_versions").insert(versions.map((version) => ({ project_id: data.id, user_id: request.user!.id, version_number: version.version_number, prompt: version.prompt, parameters: version.parameters, generation_id: version.generation_id }))); if (copyVersionsError) throw copyVersionsError; }
		response.status(201).json({ data }); } catch (error) { return failure(response, error); } }

export async function messages(request: AuthRequest, response: Response) {
	try {
		const db = requireSupabase();
		const { data, error } = await db
			.from("project_messages")
			.select("id, role, content, generation_id, created_at")
			.eq("project_id", request.params.projectId)
			.eq("user_id", request.user!.id)
			.order("created_at", { ascending: true });
		if (error) throw error;
		response.json({ data });
	} catch (error) {
		return failure(response, error);
	}
}

export async function createMessage(request: AuthRequest, response: Response) {
	const parsed = messageSchema.safeParse(request.body);
	if (!parsed.success) return response.status(422).json({ error: "Invalid project message", details: parsed.error.flatten() });
	const projectId = Array.isArray(request.params.projectId) ? request.params.projectId[0] : request.params.projectId;
	if (!projectId) return response.status(400).json({ error: "Project id is required" });

	try {
		const db = requireSupabase();
		const { data: projectData, error: projectError } = await db.from("projects").select("id, genre, mood, bpm, musical_key").eq("id", projectId).eq("user_id", request.user!.id).is("deleted_at", null).single();
		const project = projectData as ProjectConversationRow | null;
		if (projectError || !project) return response.status(404).json({ error: "Project not found" });

		const { data: recentMessages, error: recentMessagesError } = await db.from("project_messages").select("role, content").eq("project_id", projectId).eq("user_id", request.user!.id).order("created_at", { ascending: false }).limit(6);
		if (recentMessagesError) throw recentMessagesError;
		const wantsGeneration = Boolean(parsed.data.generation) || looksLikeGenerationRequest(parsed.data.content);

		if (wantsGeneration) {
			const generationInput = orchestrationSchema.parse({
				prompt: parsed.data.content,
				kind: parsed.data.generation?.kind ?? inferGenerationKind(parsed.data.content),
				workflow: "text_to_midi",
				key: parsed.data.generation?.key,
				scale: parsed.data.generation?.scale?.toLowerCase(),
				tempo: parsed.data.generation?.tempo ?? project.bpm ?? undefined,
				projectId,
				lengthBars: parsed.data.generation?.lengthBars ?? 8,
				complexity: parsed.data.generation?.complexity ?? "medium",
				variationAmount: parsed.data.generation?.variationAmount ?? 0.5,
				timeSignature: parsed.data.generation?.timeSignature ?? [4, 4],
				genre: project.genre ?? undefined,
				mood: project.mood ?? undefined,
			});

			const generation = await orchestrateGeneration(request.user!.id, generationInput);
			return response.status(201).json({ data: { mode: "generation", generation } });
		}

		const { error: userMessageError } = await db.from("project_messages").insert({ project_id: projectId, user_id: request.user!.id, role: "user", content: parsed.data.content });
		if (userMessageError) throw userMessageError;

		const reply = await generateProjectConversationReply({
			userId: request.user!.id,
			question: parsed.data.content,
			history: [...(recentMessages ?? [])].reverse(),
			project: { genre: project.genre, mood: project.mood, bpm: project.bpm, key: project.musical_key },
		});

		const { data: assistantMessage, error: assistantMessageError } = await db.from("project_messages").insert({ project_id: projectId, user_id: request.user!.id, role: "assistant", content: reply.content }).select("id, role, content, generation_id, created_at").single();
		if (assistantMessageError) throw assistantMessageError;

		response.status(201).json({
			data: {
				mode: "assistant",
				message: assistantMessage,
				recommendedDelayMs: reply.recommendedDelayMs,
			},
		});
	} catch (error) {
		return failure(response, error);
	}
}
