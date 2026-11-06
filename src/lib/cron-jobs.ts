import "server-only";
import { env } from "@/lib/env";
import { send, sendAdmin } from "@/lib/messaging";
import * as T from "@/lib/messaging/templates";
import { adminDb } from "@/lib/supabase/admin";
import { addDays, isQuietHours, nzDateString } from "@/lib/time";
import { audit } from "@/lib/audit";

const site = () => env.siteUrl();

/** T+2 days after first accept: ask the customer for feedback. */
export async function sendCustomerFeedbackRequests(now = new Date()) {
  if (isQuietHours(now)) return 0;
  const db = adminDb();
  const { data } = await db
    .from("leads")
    .select("id, ref_code, customer_mobile")
    .lte("first_accepted_at", addDays(now, -2).toISOString())
    .gte("first_accepted_at", addDays(now, -14).toISOString())
    .is("feedback_requested_at", null)
    .not("customer_mobile", "is", null)
    .not("status", "in", "(spam)")
    .limit(100);
  let n = 0;
  for (const l of data ?? []) {
    const { data: claimed } = await db
      .from("leads")
      .update({ feedback_requested_at: now.toISOString() })
      .eq("id", l.id)
      .is("feedback_requested_at", null)
      .select("id");
    if (!claimed?.length) continue;
    await send({ mobile: l.customer_mobile }, T.customerFeedbackRequest({ refCode: l.ref_code, link: `${site()}/feedback/${l.ref_code}` }), {
      template: "customer_feedback_request",
      leadId: l.id,
    });
    n++;
  }
  return n;
}

/** T+3 days after accepting: ask the partner whether the job booked. */
export async function sendPartnerOutcomePrompts(now = new Date()) {
  if (isQuietHours(now)) return 0;
  const db = adminDb();
  const { data } = await db
    .from("lead_offers")
    .select("id, token, lead_id, partner_id, leads!inner(ref_code), partners!inner(mobile, email)")
    .eq("status", "accepted")
    .is("outcome", null)
    .is("outcome_prompted_at", null)
    .lte("responded_at", addDays(now, -3).toISOString())
    .gte("responded_at", addDays(now, -21).toISOString())
    .limit(100);
  let n = 0;
  for (const o of data ?? []) {
    const { data: claimed } = await db
      .from("lead_offers")
      .update({ outcome_prompted_at: now.toISOString() })
      .eq("id", o.id)
      .is("outcome_prompted_at", null)
      .select("id");
    if (!claimed?.length) continue;
    const p = o.partners as unknown as { mobile: string; email: string };
    const ref = (o.leads as unknown as { ref_code: string }).ref_code;
    const base = `${site()}/offer/${o.token}/outcome`;
    await send(
      { mobile: p.mobile, email: p.email },
      T.partnerOutcomePrompt({
        refCode: ref,
        bookedLink: `${base}?o=booked`,
        notBookedLink: `${base}?o=not_booked`,
        detailLink: `${site()}/partner/leads/${o.lead_id}`,
      }),
      { template: "partner_outcome_prompt", leadId: o.lead_id, partnerId: o.partner_id },
    );
    n++;
  }
  return n;
}

/** Insurance reminders (−30, −7 days) and auto-pause/unpause of seats. */
export async function insuranceChecks(now = new Date()) {
  const db = adminDb();
  const today = nzDateString(now);
  let reminders = 0;

  for (const days of [30, 7]) {
    const target = nzDateString(addDays(now, days));
    const { data } = await db
      .from("partners")
      .select("id, business_name, email, mobile, insurance_expiry")
      .eq("status", "approved")
      .eq("insurance_expiry", target);
    for (const p of data ?? []) {
      const template = `insurance_reminder_${days}_${p.insurance_expiry}`;
      const { count } = await db.from("messages").select("id", { count: "exact", head: true }).eq("partner_id", p.id).eq("template", template);
      if (count) continue;
      await send(
        { mobile: p.mobile, email: p.email },
        T.insuranceReminder({ businessName: p.business_name, days, expiry: p.insurance_expiry!, link: `${site()}/partner/profile` }),
        { template, partnerId: p.id },
      );
      reminders++;
    }
  }

  // Pause live seats of partners whose insurance has lapsed (or is missing).
  const { data: lapsed } = await db.from("partners").select("id").or(`insurance_expiry.lt.${today},insurance_expiry.is.null`);
  const lapsedIds = (lapsed ?? []).map((p) => p.id);
  let paused = 0;
  if (lapsedIds.length) {
    const { data } = await db
      .from("seats")
      .update({ paused_at: now.toISOString(), paused_reason: "insurance_expired" })
      .in("partner_id", lapsedIds)
      .is("paused_at", null)
      .neq("status", "cancelled")
      .select("id, partner_id");
    paused = data?.length ?? 0;
    for (const s of data ?? []) await audit("system", "seat.paused", "seat", s.id, { reason: "insurance_expired" });
  }

  // Unpause seats once a valid expiry is on file again.
  const { data: valid } = await db.from("partners").select("id").gte("insurance_expiry", today);
  const validIds = (valid ?? []).map((p) => p.id);
  let unpaused = 0;
  if (validIds.length) {
    const { data } = await db
      .from("seats")
      .update({ paused_at: null, paused_reason: null })
      .in("partner_id", validIds)
      .eq("paused_reason", "insurance_expired")
      .select("id");
    unpaused = data?.length ?? 0;
  }
  return { reminders, paused, unpaused };
}

/** Flag partners: accept rate < 50% over last 10 offers, or avg response > 60 min. */
export async function flagPartners(now = new Date()) {
  const db = adminDb();
  const { data } = await db.rpc("partner_recent_quality", { p_last: 10 });
  let flagged = 0;
  for (const q of (data ?? []) as { partner_id: string; decided: number; accept_rate: number; avg_response_mins: number | null }[]) {
    await db.rpc("refresh_partner_metrics", { p_partner_id: q.partner_id });
    const reasons: string[] = [];
    if (Number(q.decided) >= 10 && Number(q.accept_rate) < 0.5) reasons.push(`accept rate ${(Number(q.accept_rate) * 100).toFixed(0)}% over last 10 offers`);
    if (q.avg_response_mins !== null && Number(q.avg_response_mins) > 60) reasons.push(`avg response ${Number(q.avg_response_mins).toFixed(0)} min`);
    if (!reasons.length) continue;
    const { data: p } = await db.from("partners").select("business_name, flagged_at").eq("id", q.partner_id).single();
    if (p?.flagged_at && new Date(p.flagged_at) > addDays(now, -7)) continue; // alert at most weekly
    await db.from("partners").update({ flagged_at: now.toISOString(), flag_reason: reasons.join("; ") }).eq("id", q.partner_id);
    await sendAdmin(T.adminAlert(`Partner flagged: ${p?.business_name}`, reasons, `${site()}/admin/partners/${q.partner_id}`), {
      template: "admin_partner_flag",
      partnerId: q.partner_id,
    });
    flagged++;
  }
  return flagged;
}

/** Close stale leads, purge PII past retention, trim rate-limit table. */
export async function housekeeping(now = new Date()) {
  const db = adminDb();
  const { data: closed } = await db
    .from("leads")
    .update({ status: "closed", closed_at: now.toISOString() })
    .in("status", ["accepted", "unrouted", "offered"])
    .lt("created_at", addDays(now, -60).toISOString())
    .select("id");
  const { data: purged } = await db.rpc("purge_closed_lead_pii");
  await db.from("rate_limit_hits").delete().lt("created_at", addDays(now, -2).toISOString());
  return { closed: closed?.length ?? 0, purged: purged ?? 0 };
}
