import "server-only";
import { adminDb } from "@/lib/supabase/admin";

export async function audit(actor: string, action: string, entity: string, entityId: string | null, data: Record<string, unknown> = {}) {
  const { error } = await adminDb().from("audit_log").insert({ actor, action, entity, entity_id: entityId, data });
  if (error) console.error("[audit] insert failed", error.message);
}
