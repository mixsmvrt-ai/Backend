import { requireSupabase } from "../config/supabase.js";
export async function auditAdmin(adminId: string, action: string, entityType: string, entityId?: string, metadata: Record<string, unknown> = {}) { await requireSupabase().from("admin_logs").insert({ admin_id: adminId, action, entity_type: entityType, entity_id: entityId ?? null, metadata }); }
