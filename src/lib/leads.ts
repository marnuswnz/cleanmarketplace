import "server-only";
import { slugify } from "@/lib/catalog";
import { env } from "@/lib/env";
import { newRefCode } from "@/lib/ids";
import { loadPricing } from "@/lib/pricing/load";
import { estimate } from "@/lib/pricing/estimate";
import { adminDb } from "@/lib/supabase/admin";
import { isQuietHours } from "@/lib/time";
import type { LeadRequest } from "@/lib/validation";

export type CreateLeadResult =
  | { kind: "created"; id: string; ref: string; deferred: boolean }
  | { kind: "duplicate"; ref: string }
  | { kind: "unknown_suburb" };

export async function resolveSuburb(input: string) {
  const db = adminDb();
  const slug = slugify(input);
  const { data } = await db
    .from("suburbs")
    .select("id, name, area_id, areas!inner(active)")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  if (!data || !(data.areas as unknown as { active: boolean }).active) return null;
  return { id: data.id as string, name: data.name as string, areaId: data.area_id as string };
}

export async function createLead(input: LeadRequest, meta: { ipHash: string | null; userAgent: string | null }): Promise<CreateLeadResult> {
  const db = adminDb();
  const suburb = await resolveSuburb(input.suburb);
  if (!suburb) return { kind: "unknown_suburb" };

  // Duplicate detection: same mobile + overlapping service within 7 days.
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: dup } = await db
    .from("leads")
    .select("ref_code")
    .eq("customer_mobile", input.mobile)
    .overlaps("services", input.services)
    .gte("created_at", since)
    .neq("status", "spam")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (dup) return { kind: "duplicate", ref: dup.ref_code };

  // Price server-side from the live rules; never trust a client estimate.
  const pricing = await loadPricing();
  const est = estimate(input.services, input.details, pricing);

  // Keep only the details for selected services.
  const details = Object.fromEntries(input.services.map((s) => [s, input.details[s]]));

  for (let attempt = 0; attempt < 5; attempt++) {
    const ref = newRefCode();
    const { data, error } = await db
      .from("leads")
      .insert({
        ref_code: ref,
        suburb_id: suburb.id,
        area_id: suburb.areaId,
        services: input.services,
        details: { ...details, _estimate: { lineItems: est.lineItems, quoteOnly: est.quoteOnly } },
        est_low_cents: est.low * 100,
        est_high_cents: est.high * 100,
        preferred_date: input.preferredDate ?? null,
        flexible: input.flexible,
        customer_name: input.name,
        customer_mobile: input.mobile,
        customer_email: input.email,
        notes: input.notes,
        photo_paths: input.photoPaths,
        consent_at: new Date().toISOString(),
        source: { ...(input.utm ?? {}), ip_hash: meta.ipHash, ua: meta.userAgent?.slice(0, 200) ?? null },
        status: "new",
      })
      .select("id")
      .single();
    if (!error) return { kind: "created", id: data.id, ref, deferred: isQuietHours(new Date()) };
    if (error.code !== "23505") throw error;
  }
  throw new Error("could not allocate a unique reference");
}

/** Public, PII-free lead summary for /quote/sent/[ref] and /feedback/[ref]. */
export async function publicLeadSummary(ref: string) {
  const { data } = await adminDb()
    .from("leads")
    .select("id, ref_code, services, est_low_cents, est_high_cents, status, created_at, first_accepted_at, preferred_date, suburbs!inner(name)")
    .eq("ref_code", ref.toUpperCase())
    .maybeSingle();
  if (!data) return null;
  const { data: accepted } = await adminDb()
    .from("lead_offers")
    .select("partners!inner(business_name, logo_url, gbp_url)")
    .eq("lead_id", data.id)
    .eq("status", "accepted");
  return {
    ...data,
    suburb: (data.suburbs as unknown as { name: string }).name,
    businesses: (accepted ?? []).map((a) => a.partners as unknown as { business_name: string; logo_url: string | null; gbp_url: string | null }),
    overflowPriceCents: env.overflowPriceCents(),
  };
}
