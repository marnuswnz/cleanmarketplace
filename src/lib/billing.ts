import "server-only";
import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { adminDb } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";

/**
 * Stripe Billing: one Customer per partner, one Subscription per partner
 * with one item per seat. Invoices are sent (collection_method=send_invoice)
 * so partners can start without a card on file; they can add one in the
 * Customer Portal.
 */

async function ensureCustomer(partnerId: string): Promise<string> {
  const db = adminDb();
  const { data: p, error } = await db
    .from("partners")
    .select("id, business_name, email, contact_name, mobile, nzbn, stripe_customer_id")
    .eq("id", partnerId)
    .single();
  if (error || !p) throw error ?? new Error("partner not found");
  if (p.stripe_customer_id) return p.stripe_customer_id;
  const customer = await stripe().customers.create(
    {
      name: p.business_name,
      email: p.email,
      phone: p.mobile,
      metadata: { partner_id: p.id, nzbn: p.nzbn ?? "" },
    },
    { idempotencyKey: `customer-${p.id}` },
  );
  await db.from("partners").update({ stripe_customer_id: customer.id }).eq("id", p.id);
  return customer.id;
}

/** Attach a seat to the partner's subscription (creating it if needed). */
export async function attachSeatToStripe(seatId: string): Promise<void> {
  if (!env.stripeConfigured()) {
    console.warn("[billing] STRIPE_SECRET_KEY not set; seat left unbilled", seatId);
    return;
  }
  const db = adminDb();
  const { data: seat, error } = await db
    .from("seats")
    .select("id, partner_id, stripe_subscription_item_id, areas!inner(price_tier, code), service_groups!inner(code), partners!inner(founding, stripe_subscription_id)")
    .eq("id", seatId)
    .single();
  if (error || !seat) throw error ?? new Error("seat not found");
  if (seat.stripe_subscription_item_id) return;

  type S = typeof seat & {
    areas: { price_tier: "standard" | "large"; code: string };
    service_groups: { code: string };
    partners: { founding: boolean; stripe_subscription_id: string | null };
  };
  const s = seat as unknown as S;
  const price = s.areas.price_tier === "large" ? env.stripePriceLarge() : env.stripePriceStandard();
  const metadata = { seat_id: s.id, area: s.areas.code, group: s.service_groups.code };
  const customer = await ensureCustomer(s.partner_id);

  let itemId: string;
  let status: "trial" | "active";
  let trialEndsAt: string | null = null;

  const existingSub = s.partners.stripe_subscription_id
    ? await stripe().subscriptions.retrieve(s.partners.stripe_subscription_id).catch(() => null)
    : null;

  if (existingSub && existingSub.status !== "canceled" && existingSub.status !== "incomplete_expired") {
    const item = await stripe().subscriptionItems.create(
      { subscription: existingSub.id, price, quantity: 1, metadata, proration_behavior: "create_prorations" },
      { idempotencyKey: `seat-item-${s.id}` },
    );
    itemId = item.id;
    status = existingSub.status === "trialing" ? "trial" : "active";
    trialEndsAt = existingSub.trial_end ? new Date(existingSub.trial_end * 1000).toISOString() : null;
  } else {
    const sub = await stripe().subscriptions.create(
      {
        customer,
        items: [{ price, quantity: 1, metadata }],
        collection_method: "send_invoice",
        days_until_due: 7,
        ...(s.partners.founding ? { trial_period_days: env.foundingTrialDays() } : {}),
        metadata: { partner_id: s.partner_id },
      },
      { idempotencyKey: `seat-sub-${s.id}` },
    );
    itemId = sub.items.data[0].id;
    status = sub.status === "trialing" ? "trial" : "active";
    trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
    await db.from("partners").update({ stripe_subscription_id: sub.id }).eq("id", s.partner_id);
  }

  await db.from("seats").update({ stripe_subscription_item_id: itemId, status, trial_ends_at: trialEndsAt }).eq("id", s.id);
  await audit("system", "billing.seat_attached", "seat", s.id, { itemId, status });
}

/** Remove a seat's subscription item (or cancel the subscription if it was the last). */
export async function detachSeatFromStripe(seatId: string): Promise<void> {
  if (!env.stripeConfigured()) return;
  const db = adminDb();
  const { data: seat } = await db.from("seats").select("id, partner_id, stripe_subscription_item_id").eq("id", seatId).single();
  if (!seat?.stripe_subscription_item_id) return;
  const item = await stripe().subscriptionItems.retrieve(seat.stripe_subscription_item_id).catch(() => null);
  if (!item) return;
  const sub = await stripe().subscriptions.retrieve(item.subscription);
  if (sub.items.data.length <= 1) {
    await stripe().subscriptions.update(sub.id, { cancel_at_period_end: true });
  } else {
    await stripe().subscriptionItems.del(item.id, { proration_behavior: "none" });
  }
  await audit("system", "billing.seat_detached", "seat", seatId, { itemId: item.id });
}

/** Bill an accepted overflow lead on the partner's next invoice (idempotent). */
export async function chargeOverflowLead(offerId: string): Promise<void> {
  if (!env.stripeConfigured()) {
    console.warn("[billing] STRIPE_SECRET_KEY not set; overflow lead not billed", offerId);
    return;
  }
  const db = adminDb();
  const { data: o } = await db
    .from("lead_offers")
    .select("id, partner_id, kind, status, stripe_invoice_item_id, leads!inner(ref_code)")
    .eq("id", offerId)
    .single();
  if (!o || o.kind !== "overflow" || o.status !== "accepted" || o.stripe_invoice_item_id) return;
  const customer = await ensureCustomer(o.partner_id);
  const ref = (o.leads as unknown as { ref_code: string }).ref_code;
  const item = await stripe().invoiceItems.create(
    {
      customer,
      amount: env.overflowPriceCents(),
      currency: "nzd",
      description: `Overflow lead ${ref}`,
      metadata: { offer_id: o.id, partner_id: o.partner_id },
    },
    { idempotencyKey: `overflow-${o.id}` },
  );
  await db.from("lead_offers").update({ stripe_invoice_item_id: item.id }).eq("id", o.id);
  await audit("system", "billing.overflow_charged", "lead_offer", o.id, { invoiceItem: item.id });
}

export async function portalUrl(partnerId: string, returnUrl: string): Promise<string> {
  const customer = await ensureCustomer(partnerId);
  const session = await stripe().billingPortal.sessions.create({ customer, return_url: returnUrl });
  return session.url;
}
