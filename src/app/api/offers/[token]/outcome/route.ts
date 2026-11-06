import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";

const schema = z.object({ outcome: z.enum(["booked", "not_booked", "no_contact"]) });

/** Partner one-tap job outcome (from the T+3 day prompt). Token-authenticated. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const form = await req.formData().catch(() => null);
  const parsed = schema.safeParse({ outcome: form?.get("outcome") });
  if (!parsed.success) return new Response("Invalid outcome", { status: 400 });
  const { data } = await adminDb()
    .from("lead_offers")
    .update({ outcome: parsed.data.outcome })
    .eq("token", token)
    .eq("status", "accepted")
    .select("id, partner_id")
    .maybeSingle();
  if (data) await audit(`partner:${data.partner_id}`, "offer.outcome", "lead_offer", data.id, parsed.data);
  return NextResponse.redirect(new URL(`/offer/${encodeURIComponent(token)}/outcome?saved=${data ? 1 : 0}`, req.url), 303);
}
