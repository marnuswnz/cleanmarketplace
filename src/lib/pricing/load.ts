import "server-only";
import { adminDb } from "@/lib/supabase/admin";
import { DEFAULT_PRICING } from "./defaults";
import { bundleRule, pricingConfigSchema, rangeRule, serviceRule, type PricingConfig } from "./schema";

/**
 * Assemble the live pricing config from `pricing_rules`. Invalid or missing
 * rows fall back to the defaults so a bad edit can never break quoting.
 */
export async function loadPricing(): Promise<PricingConfig> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return DEFAULT_PRICING;
  try {
    const { data, error } = await adminDb().from("pricing_rules").select("key, rule").eq("active", true);
    if (error || !data) throw error ?? new Error("no data");
    const cfg: PricingConfig = structuredClone(DEFAULT_PRICING);
    const bundles: PricingConfig["bundles"] = [];
    for (const row of data as { key: string; rule: unknown }[]) {
      if (row.key === "range") {
        const r = rangeRule.safeParse(row.rule);
        if (r.success) cfg.range = r.data;
      } else if (row.key.startsWith("bundle:")) {
        const r = bundleRule.safeParse(row.rule);
        if (r.success) bundles.push(r.data);
      } else if (row.key in cfg.services) {
        const r = serviceRule.safeParse(row.rule);
        if (r.success) (cfg.services as Record<string, unknown>)[row.key] = r.data;
      }
    }
    cfg.bundles = bundles;
    return pricingConfigSchema.parse(cfg);
  } catch (e) {
    console.error("[pricing] falling back to defaults:", e instanceof Error ? e.message : e);
    return DEFAULT_PRICING;
  }
}
