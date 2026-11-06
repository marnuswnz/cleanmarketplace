import type { PricingConfig } from "./schema";

/**
 * PLACEHOLDER prices (NZD incl. GST). The live values are rows in
 * `pricing_rules` (editable at /admin/pricing); these defaults seed the DB and
 * act as a fallback if the DB is unreachable.
 */
export const DEFAULT_PRICING: PricingConfig = {
  services: {
    end_of_tenancy: { kind: "by_bedrooms", prices: [280, 360, 450, 560, 680], extra_bathroom: 60, pets: 40 },
    deep_clean: { kind: "by_bedrooms", prices: [220, 290, 360, 440, 520], extra_bathroom: 0, pets: 0 },
    oven_clean: { kind: "oven", single: 160, double: 220, rangehood: 40 },
    carpet_clean: { kind: "carpet", callout: 90, per_room: 35, stairs: 45 },
    upholstery_clean: { kind: "upholstery", per_seat: 45, per_mattress: 60 },
    window_clean: {
      kind: "window_tiers",
      tiers: [
        { max: 15, price: 180 },
        { max: 30, price: 280 },
        { max: null, price: 380 },
      ],
      two_storey_multiplier: 1.3,
    },
    house_wash: { kind: "house_wash", single: 380, two: 580 },
  },
  bundles: [
    {
      kind: "bundle",
      label: "Move-out bundle",
      requires_all: ["end_of_tenancy"],
      requires_any: ["carpet_clean", "oven_clean"],
      discount_pct: 10,
    },
  ],
  range: { kind: "range", low: 0.9, high: 1.15, round_to: 10 },
};

/** Flatten a config into pricing_rules rows (key → rule). */
export function configToRows(cfg: PricingConfig): { key: string; rule: unknown }[] {
  const rows: { key: string; rule: unknown }[] = [];
  for (const [code, rule] of Object.entries(cfg.services)) rows.push({ key: code, rule });
  cfg.bundles.forEach((b, i) => rows.push({ key: `bundle:${i === 0 ? "move_out" : `b${i}`}`, rule: b }));
  rows.push({ key: "range", rule: cfg.range });
  return rows;
}
