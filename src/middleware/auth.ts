import type { NextFunction, Request, Response } from "express";
import { requireSupabase } from "../config/supabase.js";
import { isConfiguredAdminUser } from "../services/admin-access.service.js";

export interface AuthRequest extends Request { user?: { id: string; role: "user" | "admin" | "support" | "super_admin" } }
export async function requireAuth(request: AuthRequest, response: Response, next: NextFunction) {
  const authorization = request.header("authorization");
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (accessToken) {
    try {
      const { data, error } = await requireSupabase().auth.getUser(accessToken);
      if (error || !data.user) return response.status(401).json({ error: "Authentication required" });
      request.user = { id: data.user.id, role: "user" };
      return next();
    } catch {
      return response.status(401).json({ error: "Authentication required" });
    }
  }

  const userId = request.header("x-user-id");
  if (!userId) return response.status(401).json({ error: "Authentication required" });
  request.user = { id: userId, role: request.header("x-user-role") === "admin" ? "admin" : "user" };
  next();
}
export async function requireAdmin(request: AuthRequest, response: Response, next: NextFunction) {
  try {
    if (await isConfiguredAdminUser(request.user!.id)) {
      request.user!.role = "admin";
      return next();
    }
    const { data, error } = await requireSupabase().from("user_roles").select("role").eq("user_id", request.user!.id).single();
    if (error || (data.role !== "admin" && data.role !== "super_admin")) return response.status(403).json({ error: "Administrator access required" });
    request.user!.role = data.role;
    next();
  } catch { return response.status(503).json({ error: "Administrator authorization is unavailable" }); }
}