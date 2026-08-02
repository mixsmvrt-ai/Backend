import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

export const supabase = env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }) : null;

export function requireSupabase() {
  if (!supabase) throw new Error("Supabase server credentials are not configured.");
  return supabase;
}
