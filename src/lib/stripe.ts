import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";

let client: Stripe | null = null;
export function stripe(): Stripe {
  client ??= new Stripe(env.stripeSecret());
  return client;
}

/** Subscription id from an invoice across API versions. */
export function invoiceSubscriptionId(inv: Stripe.Invoice): string | null {
  const parent = inv.parent?.subscription_details?.subscription;
  if (parent) return typeof parent === "string" ? parent : parent.id;
  const legacy = (inv as unknown as { subscription?: string | { id: string } | null }).subscription;
  if (!legacy) return null;
  return typeof legacy === "string" ? legacy : legacy.id;
}

export function mapSubscriptionStatus(status: Stripe.Subscription.Status): "trial" | "active" | "past_due" | "cancelled" {
  switch (status) {
    case "trialing":
      return "trial";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
    case "incomplete":
    case "paused":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
    default:
      return "cancelled";
  }
}
