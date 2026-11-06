import type Stripe from "stripe";
import { env } from "@/lib/env";
import { invoiceSubscriptionId, mapSubscriptionStatus, stripe } from "@/lib/stripe";
import { adminDb } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";

type SeatStatus = "trial" | "active" | "past_due" | "cancelled";

async function setSeatsForSubscription(subscriptionId: string, status: SeatStatus, itemIds?: string[]) {
  const db = adminDb();
  const { data: partner } = await db.from("partners").select("id").eq("stripe_subscription_id", subscriptionId).maybeSingle();
  if (!partner) return 0;

  let q = db.from("seats").select("id, status, past_due_since").eq("partner_id", partner.id).neq("status", "cancelled");
  if (itemIds) q = q.in("stripe_subscription_item_id", itemIds);
  const { data: seats } = await q;
  const now = new Date().toISOString();
  for (const s of seats ?? []) {
    if (s.status === status) continue;
    await db
      .from("seats")
      .update({
        status,
        past_due_since: status === "past_due" ? (s.past_due_since ?? now) : null,
        ...(status === "cancelled" ? { cancelled_at: now } : {}),
      })
      .eq("id", s.id);
  }
  return seats?.length ?? 0;
}

async function onSubscriptionUpdated(sub: Stripe.Subscription) {
  const db = adminDb();
  const liveItems = sub.items.data.map((i) => i.id);
  const status = mapSubscriptionStatus(sub.status);
  await setSeatsForSubscription(sub.id, status, liveItems);

  // Seats whose item was removed from the subscription are cancelled.
  const { data: partner } = await db.from("partners").select("id").eq("stripe_subscription_id", sub.id).maybeSingle();
  if (partner) {
    const { data: seats } = await db
      .from("seats")
      .select("id, stripe_subscription_item_id")
      .eq("partner_id", partner.id)
      .neq("status", "cancelled")
      .not("stripe_subscription_item_id", "is", null);
    for (const s of seats ?? []) {
      if (!liveItems.includes(s.stripe_subscription_item_id!)) {
        await db.from("seats").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", s.id);
      }
    }
    if (sub.trial_end) {
      await db
        .from("seats")
        .update({ trial_ends_at: new Date(sub.trial_end * 1000).toISOString() })
        .eq("partner_id", partner.id)
        .in("stripe_subscription_item_id", liveItems);
    }
  }
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });
  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(payload, sig, env.stripeWebhookSecret());
  } catch (e) {
    return new Response(`Invalid signature: ${(e as Error).message}`, { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await onSubscriptionUpdated(event.data.object);
      break;
    case "customer.subscription.deleted":
      await setSeatsForSubscription(event.data.object.id, "cancelled");
      break;
    case "invoice.payment_failed": {
      const subId = invoiceSubscriptionId(event.data.object);
      if (subId) await setSeatsForSubscription(subId, "past_due");
      break;
    }
    case "invoice.paid": {
      const inv = event.data.object;
      const subId = invoiceSubscriptionId(inv);
      // $0 trial invoices don't end the trial.
      if (subId && inv.amount_paid > 0) await setSeatsForSubscription(subId, "active");
      break;
    }
    default:
      return Response.json({ received: true, ignored: event.type });
  }
  await audit("stripe", `stripe.${event.type}`, "stripe_event", event.id, {});
  return Response.json({ received: true });
}
