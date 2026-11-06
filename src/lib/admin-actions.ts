"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { attachSeatToStripe, detachSeatFromStripe } from "@/lib/billing";
import { env, routingConfig } from "@/lib/env";
import { send } from "@/lib/messaging";
import { partnerApproved } from "@/lib/messaging/templates";
import { notifyOffer, routeLeadById } from "@/lib/offers";
import { parseRuleForKey } from "@/lib/pricing/schema";
import { adminDb } from "@/lib/supabase/admin";
import { offerWindow } from "@/lib/time";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function actor() {
  const { user } = await requireAdmin();
  return `admin:${user.email ?? user.id}`;
}

// ---------------------------------------------------------------- leads
export async function rerouteLead(f: FormData) {
  const who = await actor();
  const id = str(f, "leadId");
  const db = adminDb();
  // Clear the unrouted flag so a fresh pass (incl. newly added seats) runs.
  await db.from("leads").update({ unrouted_groups: [], status: "routing" }).eq("id", id).not("status", "in", "(closed,spam)");
  const res = await routeLeadById(id);
  await audit(who, "lead.rerouted", "lead", id, { result: res?.groups ?? null });
  revalidatePath(`/admin/leads/${id}`);
}

async function closeLead(id: string, status: "closed" | "spam", who: string) {
  const db = adminDb();
  await db.from("lead_offers").update({ status: "cancelled" }).eq("lead_id", id).eq("status", "offered");
  await db.from("leads").update({ status, closed_at: new Date().toISOString() }).eq("id", id);
  await audit(who, `lead.${status}`, "lead", id);
  revalidatePath(`/admin/leads/${id}`);
}

export async function cancelLead(f: FormData) {
  await closeLead(str(f, "leadId"), "closed", await actor());
}

export async function markSpam(f: FormData) {
  await closeLead(str(f, "leadId"), "spam", await actor());
}

export async function cancelOffer(f: FormData) {
  const who = await actor();
  const offerId = str(f, "offerId");
  const leadId = str(f, "leadId");
  await adminDb().from("lead_offers").update({ status: "cancelled" }).eq("id", offerId).eq("status", "offered");
  await audit(who, "offer.cancelled", "lead_offer", offerId);
  revalidatePath(`/admin/leads/${leadId}`);
}

/** Hand-route: offer a lead group to a specific approved partner. */
export async function manualOffer(f: FormData) {
  const who = await actor();
  const leadId = str(f, "leadId");
  const partnerId = str(f, "partnerId");
  const groupId = str(f, "groupId");
  const db = adminDb();
  const { data: lead } = await db.from("leads").select("area_id").eq("id", leadId).single();
  const { data: seat } = await db
    .from("seats")
    .select("id")
    .eq("partner_id", partnerId)
    .eq("group_id", groupId)
    .eq("area_id", lead?.area_id ?? "")
    .neq("status", "cancelled")
    .maybeSingle();
  const w = offerWindow(new Date(), routingConfig().offerTtlMinutes);
  const { data, error } = await db
    .from("lead_offers")
    .insert({
      lead_id: leadId,
      partner_id: partnerId,
      group_id: groupId,
      seat_id: seat?.id ?? null,
      kind: seat ? "seat" : "overflow",
      round: 1,
      offered_at: w.offeredAt.toISOString(),
      expires_at: w.expiresAt.toISOString(),
    })
    .select("id")
    .single();
  if (error) redirect(`/admin/leads/${leadId}?error=${encodeURIComponent(error.message)}`);
  if (!w.deferred) await notifyOffer(data.id);
  await db.from("leads").update({ status: "offered" }).eq("id", leadId).in("status", ["new", "routing", "unrouted"]);
  await audit(who, "offer.manual", "lead_offer", data.id, { leadId, partnerId });
  revalidatePath(`/admin/leads/${leadId}`);
}

// ------------------------------------------------------------- partners
export async function setPartnerStatus(f: FormData) {
  const who = await actor();
  const id = str(f, "partnerId");
  const status = str(f, "status") as "approved" | "suspended" | "churned" | "applied";
  if (!["approved", "suspended", "churned", "applied"].includes(status)) return;
  const db = adminDb();
  const { data: p } = await db.from("partners").select("id, email, business_name, status").eq("id", id).single();
  if (!p) return;

  if (status === "approved") {
    // Create (or find) the auth user and link as owner so magic-link login works.
    let userId: string | null = null;
    const created = await db.auth.admin.createUser({ email: p.email, email_confirm: true });
    if (created.data.user) userId = created.data.user.id;
    else {
      const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
      userId = list?.users.find((u) => u.email?.toLowerCase() === p.email.toLowerCase())?.id ?? null;
    }
    if (userId) await db.from("partner_users").upsert({ user_id: userId, partner_id: p.id, role: "owner" });
    if (p.status !== "approved") {
      await send({ email: p.email }, partnerApproved({ businessName: p.business_name, loginLink: `${env.siteUrl()}/login` }), {
        template: "partner_approved",
        partnerId: p.id,
      });
    }
  }
  await db.from("partners").update({ status }).eq("id", id);
  await audit(who, `partner.${status}`, "partner", id);
  revalidatePath(`/admin/partners/${id}`);
}

export async function updatePartnerAdmin(f: FormData) {
  const who = await actor();
  const id = str(f, "partnerId");
  const expiry = str(f, "insurance_expiry");
  const update = {
    insurance_expiry: /^\d{4}-\d{2}-\d{2}$/.test(expiry) ? expiry : null,
    founding: f.get("founding") === "on",
    admin_notes: str(f, "admin_notes") || null,
    flagged_at: f.get("clear_flag") === "on" ? null : undefined,
    flag_reason: f.get("clear_flag") === "on" ? null : undefined,
  };
  await adminDb().from("partners").update(update).eq("id", id);
  await audit(who, "partner.updated", "partner", id, { insurance_expiry: update.insurance_expiry, founding: update.founding });
  revalidatePath(`/admin/partners/${id}`);
}

export async function addSeat(f: FormData) {
  const who = await actor();
  const partnerId = str(f, "partnerId");
  const areaId = str(f, "areaId");
  const groupId = str(f, "groupId");
  const priority = Number(str(f, "priority") || 0);
  const db = adminDb();
  const { data: area } = await db.from("areas").select("price_tier").eq("id", areaId).single();
  const { data: setting } = await db.from("app_settings").select("value").eq("key", "seat_price_cents").maybeSingle();
  const prices = (setting?.value as { standard: number; large: number } | undefined) ?? { standard: 14900, large: 19900 };
  const { data: partner } = await db.from("partners").select("founding").eq("id", partnerId).single();
  const { data: seat, error } = await db
    .from("seats")
    .insert({
      partner_id: partnerId,
      area_id: areaId,
      group_id: groupId,
      priority,
      status: partner?.founding ? "trial" : "active",
      monthly_price_cents: prices[(area?.price_tier as "standard" | "large") ?? "standard"],
    })
    .select("id")
    .single();
  if (error) redirect(`/admin/partners/${partnerId}?error=${encodeURIComponent(error.message)}`);
  try {
    await attachSeatToStripe(seat.id);
  } catch (e) {
    await audit(who, "billing.attach_failed", "seat", seat.id, { error: String(e) });
    redirect(`/admin/partners/${partnerId}?error=${encodeURIComponent(`Seat created but Stripe failed: ${String(e)}`)}`);
  }
  await audit(who, "seat.added", "seat", seat.id, { partnerId, areaId, groupId });
  revalidatePath(`/admin/partners/${partnerId}`);
}

export async function cancelSeat(f: FormData) {
  const who = await actor();
  const seatId = str(f, "seatId");
  const partnerId = str(f, "partnerId");
  try {
    await detachSeatFromStripe(seatId);
  } catch (e) {
    await audit(who, "billing.detach_failed", "seat", seatId, { error: String(e) });
  }
  await adminDb().from("seats").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", seatId);
  await audit(who, "seat.cancelled", "seat", seatId);
  revalidatePath(`/admin/partners/${partnerId}`);
}

export async function setSeatPriority(f: FormData) {
  const who = await actor();
  const seatId = str(f, "seatId");
  const priority = Number(str(f, "priority") || 0);
  await adminDb().from("seats").update({ priority }).eq("id", seatId);
  await audit(who, "seat.priority", "seat", seatId, { priority });
  revalidatePath("/admin/seats");
}

// -------------------------------------------------------------- pricing
export async function savePricingRule(f: FormData) {
  const who = await actor();
  const key = str(f, "key");
  const raw = str(f, "rule");
  let rule: unknown;
  try {
    rule = parseRuleForKey(key, JSON.parse(raw));
  } catch (e) {
    const msg = e instanceof SyntaxError ? `Invalid JSON: ${e.message}` : e instanceof Error ? e.message : String(e);
    redirect(`/admin/pricing?key=${encodeURIComponent(key)}&error=${encodeURIComponent(msg.slice(0, 500))}`);
  }
  const db = adminDb();
  const { data: before } = await db.from("pricing_rules").select("rule").eq("key", key).maybeSingle();
  await db.from("pricing_rules").update({ rule, updated_at: new Date().toISOString() }).eq("key", key);
  await audit(who, "pricing.updated", "pricing_rule", key, { before: before?.rule ?? null, after: rule });
  revalidatePath("/", "layout");
  redirect(`/admin/pricing?saved=${encodeURIComponent(key)}`);
}
