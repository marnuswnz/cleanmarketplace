import { randomUUID } from "node:crypto";
import { z } from "zod";
import { adminDb } from "@/lib/supabase/admin";
import { clientIp, hash, json, rateLimit } from "@/lib/request";

const schema = z.object({ contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic"]) });
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };

/** Issue a one-time signed upload URL for a quote photo (private bucket). */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid" }, 400);
  const ip = clientIp(req);
  if (ip && !(await rateLimit(`upload:${hash(ip)}`, 3600, 20))) return json({ error: "rate_limited" }, 429);
  const path = `pending/${randomUUID()}.${EXT[parsed.data.contentType]}`;
  const { data, error } = await adminDb().storage.from("lead-photos").createSignedUploadUrl(path);
  if (error || !data) return json({ error: "server" }, 500);
  return json({ path, signedUrl: data.signedUrl, token: data.token });
}
