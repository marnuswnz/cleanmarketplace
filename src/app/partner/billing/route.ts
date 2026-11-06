import { NextResponse } from "next/server";
import { portalUrl } from "@/lib/billing";
import { env } from "@/lib/env";
import { userDb } from "@/lib/supabase/server";

/** Redirect a signed-in partner owner to the Stripe Customer Portal. */
export async function GET(req: Request) {
  const db = await userDb();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return NextResponse.redirect(new URL("/login?next=/partner", req.url));
  const { data: link } = await db.from("partner_users").select("partner_id, role").eq("user_id", auth.user.id).limit(1).maybeSingle();
  if (!link || link.role !== "owner") return NextResponse.redirect(new URL("/partner?error=billing", req.url));
  if (!env.stripeConfigured()) return NextResponse.redirect(new URL("/partner?error=billing_unconfigured", req.url));
  const url = await portalUrl(link.partner_id, `${env.siteUrl()}/partner`);
  return NextResponse.redirect(url, 303);
}
