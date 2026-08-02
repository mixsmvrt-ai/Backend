import { env } from "../config/env.js";
import { requireSupabase } from "../config/supabase.js";

function normalizeEmail(email: string | null | undefined) {
	return email?.trim().toLowerCase() ?? "";
}

export async function isConfiguredAdminUser(userId: string) {
	if (!env.ADMIN_EMAILS.length) return false;
	const { data, error } = await requireSupabase().auth.admin.getUserById(userId);
	if (error) throw error;
	return env.ADMIN_EMAILS.includes(normalizeEmail(data.user?.email));
}