import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let cached: SupabaseClient | null = null;

/** Service-role client: bypasses RLS. Server-only (routes, cron, webhooks). */
export function adminDb(): SupabaseClient {
  cached ??= createClient(env.supabaseUrl(), env.supabaseServiceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
