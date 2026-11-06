import { adminDb } from "@/lib/supabase/admin";
import { clientIp, hash, json, rateLimit, zodErrors } from "@/lib/request";
import { waitlistSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const parsed = waitlistSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid", fields: zodErrors(parsed.error.issues) }, 400);
  const ip = clientIp(req);
  if (ip && !(await rateLimit(`waitlist:${hash(ip)}`, 3600, 10))) return json({ error: "rate_limited" }, 429);
  const { error } = await adminDb().from("waitlist").insert({
    email: parsed.data.email.toLowerCase(),
    suburb_text: parsed.data.suburb ?? null,
    service: parsed.data.service ?? null,
  });
  if (error) return json({ error: "server" }, 500);
  return json({ ok: true }, 201);
}
