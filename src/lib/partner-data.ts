import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface PartnerOffer {
  offer_id: string;
  lead_id: string;
  ref_code: string;
  status: "offered" | "accepted" | "declined" | "expired" | "cancelled";
  kind: "seat" | "overflow";
  group_code: string;
  offered_at: string;
  expires_at: string;
  responded_at: string | null;
  outcome: "booked" | "not_booked" | "no_contact" | null;
  price_cents: number | null;
  token: string | null;
  suburb_name: string;
  area_name: string;
  services: string[];
  details: Record<string, unknown>;
  est_low_cents: number | null;
  est_high_cents: number | null;
  preferred_date: string | null;
  flexible: boolean;
  customer_name: string | null;
  customer_mobile: string | null;
  customer_email: string | null;
  notes: string | null;
}

/** The partner's offer inbox via RLS-safe RPC (contact fields only on accepted offers). */
export async function partnerOffers(db: SupabaseClient): Promise<PartnerOffer[]> {
  const { data, error } = await db.rpc("get_partner_offers");
  if (error) throw error;
  return (data ?? []) as PartnerOffer[];
}
