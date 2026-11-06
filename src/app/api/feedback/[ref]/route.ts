import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { sendAdmin } from "@/lib/messaging";
import { adminAlert } from "@/lib/messaging/templates";
import { clientIp, hash, rateLimit } from "@/lib/request";
import { adminDb } from "@/lib/supabase/admin";
import { feedbackSchema } from "@/lib/validation";

const yn = (v: FormDataEntryValue | null) => (v === "yes" ? true : v === "no" ? false : null);

export async function POST(req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const ref = (await params).ref.toUpperCase();
  const back = (q: string) => NextResponse.redirect(new URL(`/feedback/${encodeURIComponent(ref)}?${q}`, req.url), 303);
  const ip = clientIp(req);
  if (ip && !(await rateLimit(`feedback:${hash(ip)}`, 3600, 10))) return back("error=rate");

  const form = await req.formData();
  const parsed = feedbackSchema.safeParse({
    contacted: yn(form.get("contacted")) ?? undefined,
    booked: yn(form.get("booked")),
    rating: form.get("rating") ? Number(form.get("rating")) : null,
    comment: (form.get("comment") as string | null) || null,
  });
  if (!parsed.success) return back("error=invalid");

  const db = adminDb();
  const { data: lead } = await db.from("leads").select("id, first_accepted_at").eq("ref_code", ref).maybeSingle();
  if (!lead?.first_accepted_at) return back("error=notfound");

  const fb = parsed.data;
  const { error } = await db.from("feedback").insert({ lead_id: lead.id, ...fb, comment: fb.comment ?? null });
  if (error?.code === "23505") return back("done=1");
  if (error) return back("error=server");

  const { data: offers } = await db
    .from("lead_offers")
    .select("partner_id, partners!inner(business_name)")
    .eq("lead_id", lead.id)
    .eq("status", "accepted");
  for (const o of offers ?? []) await db.rpc("refresh_partner_metrics", { p_partner_id: o.partner_id });

  if (!fb.contacted || (fb.rating !== null && fb.rating <= 2)) {
    const names = (offers ?? []).map((o) => (o.partners as unknown as { business_name: string }).business_name).join(", ");
    await sendAdmin(
      adminAlert(
        `Poor feedback on ${ref}`,
        [
          `Contacted: ${fb.contacted ? "yes" : "NO"} · Booked: ${fb.booked === null ? "n/a" : fb.booked ? "yes" : "no"} · Rating: ${fb.rating ?? "n/a"}`,
          `Businesses: ${names || "none"}`,
          ...(fb.comment ? [`Comment: ${fb.comment}`] : []),
        ],
        `${env.siteUrl()}/admin/leads/${lead.id}`,
      ),
      { template: "admin_feedback_alert", leadId: lead.id },
    );
  }
  return back("done=1");
}
