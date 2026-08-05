import { Router } from "express";
import { requireSupabase } from "../config/supabase.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { membershipFor } from "../services/membership.service.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);
dashboardRouter.get("/overview", async (request: AuthRequest, response, next) => {
	try {
		const db = requireSupabase();
		const [projects, generations, downloads, storage, activity, membership] = await Promise.all([
			db.from("projects").select("id,title,description,updated_at,created_at", { count: "exact" }).eq("user_id", request.user!.id).is("deleted_at", null).is("archived_at", null).order("updated_at", { ascending: false }).limit(5),
			db.from("generations").select("id,status,created_at,project_id,generation_requests(prompt,kind),generation_files(file_name,file_size_bytes)", { count: "exact" }).eq("user_id", request.user!.id).order("created_at", { ascending: false }).limit(5),
			db.from("downloads").select("id,file_name,file_size_bytes,generated_at,project_id,projects(title)", { count: "exact" }).eq("user_id", request.user!.id).is("deleted_at", null).order("generated_at", { ascending: false }).limit(5),
			db.from("storage_files").select("size_bytes").eq("user_id", request.user!.id).is("deleted_at", null),
			db.from("activity_log").select("id,action,entity_type,entity_id,metadata,created_at").eq("user_id", request.user!.id).order("created_at", { ascending: false }).limit(8),
			membershipFor(request.user!.id),
		]);
		[projects, generations, downloads, storage, activity].forEach(({ error }) => { if (error) throw error; });
		response.json({
			data: {
				stats: {
					totalProjects: projects.count ?? 0,
					totalGenerations: generations.count ?? 0,
					totalDownloads: downloads.count ?? 0,
					storageBytes: (storage.data ?? []).reduce((sum, file) => sum + Number(file.size_bytes ?? 0), 0),
				},
				recentProjects: projects.data ?? [],
				recentGenerations: generations.data ?? [],
				recentDownloads: downloads.data ?? [],
				recentActivity: activity.data ?? [],
				membership,
			},
		});
	} catch (error) {
		next(error);
	}
});
dashboardRouter.get("/templates", async (_request, response, next) => { try { const { data, error } = await requireSupabase().from("templates").select("*").order("genre").order("name"); if (error) throw error; response.json({ data }); } catch (error) { next(error); } });
dashboardRouter.get("/plugins", async (request: AuthRequest, response, next) => { try { const query = String(request.query.query ?? ""); let builder = requireSupabase().from("plugin_library").select("*").order("name"); if (query) builder = builder.ilike("name", `%${query}%`); const { data, error } = await builder; if (error) throw error; response.json({ data }); } catch (error) { next(error); } });
dashboardRouter.get("/downloads", async (request: AuthRequest, response, next) => { try { const { data, error } = await requireSupabase().from("downloads").select("*, projects(title)").eq("user_id", request.user!.id).is("deleted_at", null).order("generated_at", { ascending: false }); if (error) throw error; response.json({ data }); } catch (error) { next(error); } });
dashboardRouter.get("/downloads/:downloadId", async (request: AuthRequest, response, next) => {
	try {
		const { data, error } = await requireSupabase().from("downloads").select("*, projects(title)").eq("id", request.params.downloadId).eq("user_id", request.user!.id).is("deleted_at", null).single();
		if (error || !data) return response.status(404).json({ error: "Download not found" });
		response.json({ data });
	} catch (error) {
		next(error);
	}
});
dashboardRouter.get("/downloads/:downloadId/url", async (request: AuthRequest, response, next) => {
	try {
		const db = requireSupabase();
		const { data: download, error } = await db.from("downloads").select("id,file_name,storage_path").eq("id", request.params.downloadId).eq("user_id", request.user!.id).is("deleted_at", null).single();
		if (error || !download) return response.status(404).json({ error: "Download not found" });
		const { data: signed, error: signError } = await db.storage.from("midi-exports").createSignedUrl(download.storage_path, 900, { download: download.file_name });
		if (signError || !signed) throw signError ?? new Error("Unable to create download url");
		response.json({ data: { url: signed.signedUrl, fileName: download.file_name } });
	} catch (error) {
		next(error);
	}
});
dashboardRouter.delete("/downloads/:downloadId", async (request: AuthRequest, response, next) => {
	try {
		const { error } = await requireSupabase().from("downloads").update({ deleted_at: new Date().toISOString() }).eq("id", request.params.downloadId).eq("user_id", request.user!.id);
		if (error) throw error;
		response.status(204).end();
	} catch (error) {
		next(error);
	}
});
dashboardRouter.get("/notifications", async (request: AuthRequest, response, next) => { try { const { data, error } = await requireSupabase().from("notifications").select("*").eq("user_id", request.user!.id).order("created_at", { ascending: false }).limit(30); if (error) throw error; response.json({ data }); } catch (error) { next(error); } });
dashboardRouter.get("/activity", async (request: AuthRequest, response, next) => { try { const { data, error } = await requireSupabase().from("activity_log").select("*").eq("user_id", request.user!.id).order("created_at", { ascending: false }).limit(30); if (error) throw error; response.json({ data }); } catch (error) { next(error); } });
dashboardRouter.get("/search", async (request: AuthRequest, response, next) => { try { const query = String(request.query.query ?? "").trim(); if (!query) return response.json({ data: { projects: [], templates: [], plugins: [], downloads: [] } }); const db = requireSupabase(); const [projects, templates, plugins, downloads] = await Promise.all([db.from("projects").select("id,title").eq("user_id", request.user!.id).is("deleted_at", null).ilike("title", `%${query}%`).limit(10), db.from("templates").select("id,name,genre").ilike("name", `%${query}%`).limit(10), db.from("plugin_library").select("id,name,developer").ilike("name", `%${query}%`).limit(10), db.from("downloads").select("id,file_name").eq("user_id", request.user!.id).is("deleted_at", null).ilike("file_name", `%${query}%`).limit(10)]); [projects, templates, plugins, downloads].forEach(({ error }) => { if (error) throw error; }); response.json({ data: { projects: projects.data, templates: templates.data, plugins: plugins.data, downloads: downloads.data } }); } catch (error) { next(error); } });
