import { z } from "zod";
import { SERVICE_CODES } from "@/lib/catalog";

const money = z.number().nonnegative().max(100000);

/** Prices indexed by bedroom count: [1, 2, 3, 4, 5+]. */
const bedroomPrices = z.array(money).length(5);

export const byBedroomsRule = z.object({
  kind: z.literal("by_bedrooms"),
  prices: bedroomPrices,
  extra_bathroom: money.default(0),
  pets: money.default(0),
});

export const carpetRule = z.object({
  kind: z.literal("carpet"),
  callout: money,
  per_room: money,
  stairs: money,
});

export const upholsteryRule = z.object({
  kind: z.literal("upholstery"),
  per_seat: money,
  per_mattress: money,
});

export const ovenRule = z.object({
  kind: z.literal("oven"),
  single: money,
  double: money,
  rangehood: money,
});

export const windowTiersRule = z.object({
  kind: z.literal("window_tiers"),
  /** Ordered tiers; the last tier must have max = null (open-ended). */
  tiers: z
    .array(z.object({ max: z.number().int().positive().nullable(), price: money }))
    .min(1)
    .refine((t) => t[t.length - 1].max === null, "last tier must be open-ended (max: null)")
    .refine(
      (t) => t.slice(0, -1).every((x, i, arr) => x.max !== null && (i === 0 || x.max > (arr[i - 1].max ?? 0))),
      "tier max values must be ascending",
    ),
  two_storey_multiplier: z.number().min(1).max(5),
});

export const houseWashRule = z.object({
  kind: z.literal("house_wash"),
  single: money,
  two: money,
});

export const serviceRule = z.discriminatedUnion("kind", [
  byBedroomsRule,
  carpetRule,
  upholsteryRule,
  ovenRule,
  windowTiersRule,
  houseWashRule,
]);
export type ServiceRule = z.infer<typeof serviceRule>;

export const serviceCode = z.enum(SERVICE_CODES);

export const bundleRule = z.object({
  kind: z.literal("bundle"),
  label: z.string().min(1),
  /** All of these must be selected... */
  requires_all: z.array(serviceCode).min(1),
  /** ...plus at least one of these (empty = no extra requirement). */
  requires_any: z.array(serviceCode).default([]),
  discount_pct: z.number().min(0).max(50),
});
export type BundleRule = z.infer<typeof bundleRule>;

export const rangeRule = z.object({
  kind: z.literal("range"),
  low: z.number().min(0.5).max(1),
  high: z.number().min(1).max(2),
  round_to: z.number().int().positive(),
});
export type RangeRule = z.infer<typeof rangeRule>;

/** Which rule kind each service expects. */
export const EXPECTED_KIND: Record<z.infer<typeof serviceCode>, ServiceRule["kind"]> = {
  end_of_tenancy: "by_bedrooms",
  deep_clean: "by_bedrooms",
  oven_clean: "oven",
  carpet_clean: "carpet",
  upholstery_clean: "upholstery",
  window_clean: "window_tiers",
  house_wash: "house_wash",
};

export const pricingConfigSchema = z
  .object({
    services: z.record(serviceCode, serviceRule),
    bundles: z.array(bundleRule),
    range: rangeRule,
  })
  .superRefine((cfg, ctx) => {
    for (const [code, rule] of Object.entries(cfg.services)) {
      const expected = EXPECTED_KIND[code as keyof typeof EXPECTED_KIND];
      if (rule && rule.kind !== expected) {
        ctx.addIssue({ code: "custom", path: ["services", code, "kind"], message: `expected kind "${expected}"` });
      }
    }
  });
export type PricingConfig = z.infer<typeof pricingConfigSchema>;

/** Validate a single DB row's rule JSON given its key. */
export function parseRuleForKey(key: string, rule: unknown) {
  if (key === "range") return rangeRule.parse(rule);
  if (key.startsWith("bundle:")) return bundleRule.parse(rule);
  const code = serviceCode.parse(key);
  const parsed = serviceRule.parse(rule);
  if (parsed.kind !== EXPECTED_KIND[code]) {
    throw new Error(`Rule for ${code} must have kind "${EXPECTED_KIND[code]}"`);
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Job details captured by the quote form (stored in leads.details)
// ---------------------------------------------------------------------------
const count = (max: number) => z.coerce.number().int().min(0).max(max);

export const serviceDetailsSchema = z.object({
  end_of_tenancy: z
    .object({ bedrooms: z.coerce.number().int().min(1).max(10), bathrooms: z.coerce.number().int().min(1).max(10), pets: z.boolean() })
    .optional(),
  deep_clean: z
    .object({ bedrooms: z.coerce.number().int().min(1).max(10), bathrooms: z.coerce.number().int().min(1).max(10).default(1) })
    .optional(),
  carpet_clean: z.object({ rooms: count(30), hallway: z.boolean(), stairs: z.boolean() }).optional(),
  upholstery_clean: z.object({ seats: count(40), mattresses: count(10) }).optional(),
  oven_clean: z.object({ type: z.enum(["single", "double"]), rangehood: z.boolean() }).optional(),
  window_clean: z.object({ windows: z.coerce.number().int().min(1).max(200), storeys: z.union([z.literal(1), z.literal(2)]) }).optional(),
  house_wash: z.object({ storeys: z.union([z.literal(1), z.literal(2)]), roof: z.boolean() }).optional(),
});
export type ServiceDetails = z.infer<typeof serviceDetailsSchema>;
