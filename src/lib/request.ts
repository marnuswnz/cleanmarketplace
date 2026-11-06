import "server-only";
import { createHash } from "node:crypto";
import { adminDb } from "@/lib/supabase/admin";

export function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
}

export const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);

/** Sliding-window rate limit backed by Postgres (works across serverless instances). */
export async function rateLimit(key: string, windowSeconds: number, max: number): Promise<boolean> {
  const { data, error } = await adminDb().rpc("rate_limit_hit", { p_key: key, p_window_seconds: windowSeconds, p_max: max });
  if (error) {
    console.error("[rate-limit] failing open", error.message);
    return true;
  }
  return data === true;
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function zodErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = i.path.map(String).join(".") || "_";
    out[k] ??= i.message;
  }
  return out;
}
