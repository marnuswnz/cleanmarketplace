import "server-only";
import { redirect } from "next/navigation";
import { userDb } from "@/lib/supabase/server";

export async function currentUser() {
  const db = await userDb();
  const { data } = await db.auth.getUser();
  return { db, user: data.user };
}

/** Require a signed-in partner user; returns their partner row (RLS-scoped client). */
export async function requirePartner() {
  const { db, user } = await currentUser();
  if (!user) redirect("/login?next=/partner");
  const { data: link } = await db.from("partner_users").select("partner_id, role").eq("user_id", user.id).limit(1).maybeSingle();
  if (!link) redirect("/login?error=no_partner");
  const { data: partner } = await db.from("partners").select("*").eq("id", link.partner_id).single();
  if (!partner) redirect("/login?error=no_partner");
  return { db, user, partner, role: link.role as "owner" | "staff" };
}

export async function requireAdmin() {
  const { db, user } = await currentUser();
  if (!user) redirect("/login?next=/admin");
  const { data } = await db.rpc("is_admin");
  if (data !== true) redirect("/login?error=not_admin");
  return { db, user };
}

export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
