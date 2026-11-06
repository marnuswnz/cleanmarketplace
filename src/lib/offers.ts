import "server-only";
import type { GroupCode } from "@/lib/catalog";
import { GROUP_BY_CODE } from "@/lib/catalog";
import { env, routingConfig } from "@/lib/env";
import { send, sendAdmin } from "@/lib/messaging";
import * as T from "@/lib/messaging/templates";
import { routeLead, type CreatedOffer, type RouteResult, type RoutingNotifier } from "@/lib/routing";
import { SupabaseRoutingStore } from "@/lib/routing-store";
import { adminDb } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { chargeOverflowLead } from "@/lib/billing";

const site = () => env.siteUrl();

interface OfferContext {
  id: string;
  token: string;
  kind: "seat" | "overflow";
  status: string;
  partner_id: string;
  lead_id: string;
  partners: { id: string; business_name: string; email: string; mobile: string };
  leads: {
    id: string;
    ref_code: string;
    services: string[];
    est_low_cents: number | null;
    est_high_cents: number | null;
    preferred_date: string | null;
    flexible: boolean;
    customer_name: string | null;
    customer_mobile: string | null;
    customer_email: string | null;
    notes: string | null;
    suburbs: { name: string };
  };
}

async function loadOffer(offerId: string): Promise<OfferContext | null> {
  const { data } = await adminDb()
    .from("lead_offers")
    .select(
      "id, token, kind, status, partner_id, lead_id, partners!inner(id, business_name, email, mobile), leads!inner(id, ref_code, services, est_low_cents, est_high_cents, preferred_date, flexible, customer_name, customer_mobile, customer_email, notes, suburbs!inner(name))",
    )
    .eq("id", offerId)
    .maybeSingle();
  return (data as unknown as OfferContext) ?? null;
}

/** Send the offer SMS + email to the partner and stamp notified_at. */
export async function notifyOffer(offerId: string): Promise<void> {
  // Claim the notification first so concurrent cron runs can't double-send.
  const { data: claimed } = await adminDb()
    .from("lead_offers")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", offerId)
    .is("notified_at", null)
    .eq("status", "offered")
    .select("id");
  if (!claimed?.length) return;

  const o = await loadOffer(offerId);
  if (!o) return;
  const msg = T.partnerOffer({
    businessName: o.partners.business_name,
    refCode: o.leads.ref_code,
    suburb: o.leads.suburbs.name,
    services: o.leads.services,
    estLowCents: o.leads.est_low_cents,
    estHighCents: o.leads.est_high_cents,
    preferredDate: o.leads.preferred_date,
    flexible: o.leads.flexible,
    ttlMinutes: env.offerTtlMinutes(),
    link: `${site()}/offer/${o.token}`,
    kind: o.kind,
    overflowPriceCents: env.overflowPriceCents(),
  });
  await send({ mobile: o.partners.mobile, email: o.partners.email }, msg, {
    template: "partner_offer",
    leadId: o.lead_id,
    partnerId: o.partner_id,
  });
}

export const notifier: RoutingNotifier = {
  async offerCreated(offer: CreatedOffer) {
    await notifyOffer(offer.id);
  },
  async groupUnrouted(leadId: string, group: GroupCode) {
    const { data: lead } = await adminDb()
      .from("leads")
      .select("ref_code, customer_name, customer_mobile, customer_email, services, suburbs(name)")
      .eq("id", leadId)
      .single();
    if (!lead) return;
    const suburb = (lead.suburbs as unknown as { name: string } | null)?.name ?? "";
    await sendAdmin(
      T.adminAlert(
        `Unrouted lead ${lead.ref_code} (${GROUP_BY_CODE[group].name})`,
        [
          `No partner accepted ${GROUP_BY_CODE[group].name} for lead ${lead.ref_code} in ${suburb} after seat and overflow rounds.`,
          `Services: ${T.serviceList(lead.services)}`,
        ],
        `${site()}/admin/leads/${leadId}`,
      ),
      { template: "admin_unrouted", leadId },
    );
    await send(
      { mobile: lead.customer_mobile, email: lead.customer_email },
      T.customerFindingBusiness({ customerName: lead.customer_name ?? "there", refCode: lead.ref_code }),
      { template: "customer_finding_business", leadId },
    );
    await audit("system", "lead.group_unrouted", "lead", leadId, { group });
  },
};

export async function routeLeadById(leadId: string, now = new Date()): Promise<RouteResult | null> {
  const store = new SupabaseRoutingStore();
  return routeLead(store, notifier, leadId, routingConfig(), now);
}

/** Notify partners of offers whose quiet-hours deferral has elapsed. */
export async function dispatchDueOffers(now = new Date()): Promise<number> {
  const { data } = await adminDb()
    .from("lead_offers")
    .select("id")
    .eq("status", "offered")
    .is("notified_at", null)
    .lte("offered_at", now.toISOString())
    .limit(200);
  for (const row of data ?? []) await notifyOffer(row.id);
  return data?.length ?? 0;
}

/** Expire lapsed offers and move each affected lead to the next partner. */
export async function expireAndReroute(now = new Date()): Promise<{ expired: number; rerouted: number }> {
  const { data, error } = await adminDb().rpc("expire_lapsed_offers");
  if (error) throw error;
  const rows = (data ?? []) as { lead_id: string; partner_id: string }[];
  const leads = [...new Set(rows.map((r) => r.lead_id))];
  for (const p of new Set(rows.map((r) => r.partner_id))) await adminDb().rpc("refresh_partner_metrics", { p_partner_id: p });
  for (const id of leads) {
    try {
      await routeLeadById(id, now);
    } catch (e) {
      console.error("[expire] reroute failed", id, e);
    }
  }
  return { expired: rows.length, rerouted: leads.length };
}

/** Leads that never got routed (e.g. the request died mid-routing). */
export async function routeStuckLeads(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 2 * 60_000).toISOString();
  const { data } = await adminDb().from("leads").select("id").in("status", ["new", "routing"]).lt("created_at", cutoff).limit(50);
  for (const l of data ?? []) {
    try {
      await routeLeadById(l.id, now);
    } catch (e) {
      console.error("[route-stuck] failed", l.id, e);
    }
  }
  return data?.length ?? 0;
}

export type OfferResponse =
  | "accepted"
  | "already_accepted"
  | "declined"
  | "already_declined"
  | "expired"
  | "cancelled"
  | "filled"
  | "not_found"
  | string;

export async function respondToOffer(token: string, action: "accept" | "decline"): Promise<{ result: OfferResponse; leadId?: string }> {
  const { data, error } = await adminDb().rpc(action === "accept" ? "accept_offer" : "decline_offer", { p_token: token });
  if (error) throw error;
  const r = data as { result: OfferResponse; offer_id?: string; lead_id?: string; partner_id?: string; kind?: string; newly_expired?: boolean };

  if (r.result === "accepted" && r.offer_id) {
    await onAccepted(r.offer_id);
  }
  if ((r.result === "declined" || r.result === "accepted") && r.partner_id) {
    await adminDb().rpc("refresh_partner_metrics", { p_partner_id: r.partner_id });
    await audit(`partner:${r.partner_id}`, `offer.${r.result}`, "lead_offer", r.offer_id ?? null, { lead_id: r.lead_id });
  }
  if (r.lead_id && (r.result === "declined" || r.result === "accepted" || r.newly_expired || r.result === "filled")) {
    await routeLeadById(r.lead_id);
  }
  return { result: r.result, leadId: r.lead_id };
}

async function onAccepted(offerId: string) {
  const o = await loadOffer(offerId);
  if (!o) return;
  const l = o.leads;
  await Promise.all([
    send(
      { mobile: o.partners.mobile, email: o.partners.email },
      T.partnerAccepted({
        businessName: o.partners.business_name,
        refCode: l.ref_code,
        suburb: l.suburbs.name,
        services: l.services,
        customerName: l.customer_name ?? "Customer",
        customerMobile: l.customer_mobile ?? "",
        customerEmail: l.customer_email,
        notes: l.notes,
        preferredDate: l.preferred_date,
        estLowCents: l.est_low_cents,
        estHighCents: l.est_high_cents,
        link: `${site()}/partner/leads/${l.id}`,
      }),
      { template: "partner_accepted", leadId: l.id, partnerId: o.partner_id },
    ),
    send(
      { mobile: l.customer_mobile, email: l.customer_email },
      T.customerPartnerAssigned({
        businessName: o.partners.business_name,
        refCode: l.ref_code,
        customerName: l.customer_name ?? "there",
        services: l.services,
      }),
      { template: "customer_partner_assigned", leadId: l.id, partnerId: o.partner_id },
    ),
    o.kind === "overflow" ? chargeOverflowLead(offerId).catch((e) => console.error("[billing] overflow charge failed", e)) : null,
  ]);
}
