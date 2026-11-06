import { SERVICE_BY_CODE, type ServiceCode } from "@/lib/catalog";
import type { PricingConfig, ServiceDetails, ServiceRule } from "./schema";

/**
 * Pure, deterministic price estimator shared by the browser (live estimate in
 * the quote form) and the server (/api/estimate, /api/leads). All arithmetic
 * is done on integers (whole dollars, basis points) so client and server
 * always agree.
 */

export interface LineItem {
  service: ServiceCode | "bundle";
  label: string;
  /** Whole NZD incl. GST; negative for discounts. */
  amount: number;
}

export interface Estimate {
  /** Rounded range, whole NZD incl. GST. */
  low: number;
  high: number;
  /** Sum of line items (after discounts). */
  estimate: number;
  lineItems: LineItem[];
  /** Items that can't be estimated and will be quoted on site. */
  quoteOnly: string[];
}

export const DEFAULT_DETAILS: Required<ServiceDetails> = {
  end_of_tenancy: { bedrooms: 3, bathrooms: 1, pets: false },
  deep_clean: { bedrooms: 3, bathrooms: 1 },
  carpet_clean: { rooms: 3, hallway: true, stairs: false },
  upholstery_clean: { seats: 3, mattresses: 0 },
  oven_clean: { type: "single", rangehood: false },
  window_clean: { windows: 12, storeys: 1 },
  house_wash: { storeys: 1, roof: false },
};

const bp = (x: number) => Math.round(x * 10000);
/** Multiply whole dollars by a decimal factor using basis points. */
const mul = (amount: number, factor: number) => Math.round((amount * bp(factor)) / 10000);
const roundTo = (amount: number, step: number) => Math.round(amount / step) * step;

function bedroomIndex(bedrooms: number): number {
  return Math.min(Math.max(Math.trunc(bedrooms), 1), 5) - 1;
}

function priceService(
  code: ServiceCode,
  rule: ServiceRule,
  details: ServiceDetails,
  quoteOnly: string[],
): LineItem[] {
  const name = SERVICE_BY_CODE[code].name;
  const items: LineItem[] = [];
  const push = (label: string, amount: number) => items.push({ service: code, label, amount: Math.round(amount) });

  switch (rule.kind) {
    case "by_bedrooms": {
      const d = (details[code as "end_of_tenancy" | "deep_clean"] ?? DEFAULT_DETAILS[code as "end_of_tenancy"]) as {
        bedrooms: number;
        bathrooms?: number;
        pets?: boolean;
      };
      const idx = bedroomIndex(d.bedrooms);
      push(`${name} — ${idx === 4 ? "5+" : idx + 1} bedroom`, rule.prices[idx]);
      const extraBaths = Math.max((d.bathrooms ?? 1) - 1, 0);
      if (extraBaths > 0 && rule.extra_bathroom > 0) {
        push(`Extra bathroom × ${extraBaths}`, extraBaths * rule.extra_bathroom);
      }
      if (d.pets && rule.pets > 0) push("Pets in the home", rule.pets);
      break;
    }
    case "carpet": {
      const d = details.carpet_clean ?? DEFAULT_DETAILS.carpet_clean;
      const rooms = d.rooms + (d.hallway ? 1 : 0);
      push(`${name} — call-out`, rule.callout);
      if (rooms > 0) push(`${rooms} room${rooms === 1 ? "" : "s"}${d.hallway ? " (incl. hallway)" : ""}`, rooms * rule.per_room);
      if (d.stairs) push("Stairs", rule.stairs);
      break;
    }
    case "upholstery": {
      const d = details.upholstery_clean ?? DEFAULT_DETAILS.upholstery_clean;
      if (d.seats > 0) push(`${name} — ${d.seats} seat${d.seats === 1 ? "" : "s"}`, d.seats * rule.per_seat);
      if (d.mattresses > 0) push(`Mattress × ${d.mattresses}`, d.mattresses * rule.per_mattress);
      break;
    }
    case "oven": {
      const d = details.oven_clean ?? DEFAULT_DETAILS.oven_clean;
      push(`${name} — ${d.type} oven`, d.type === "double" ? rule.double : rule.single);
      if (d.rangehood) push("Rangehood", rule.rangehood);
      break;
    }
    case "window_tiers": {
      const d = details.window_clean ?? DEFAULT_DETAILS.window_clean;
      const tier = rule.tiers.find((t) => t.max === null || d.windows <= t.max) ?? rule.tiers[rule.tiers.length - 1];
      const base = d.storeys === 2 ? mul(tier.price, rule.two_storey_multiplier) : tier.price;
      push(`${name} — ${d.windows} windows${d.storeys === 2 ? ", two storey" : ""}`, base);
      break;
    }
    case "house_wash": {
      const d = details.house_wash ?? DEFAULT_DETAILS.house_wash;
      push(`${name} — ${d.storeys === 2 ? "two" : "single"} storey`, d.storeys === 2 ? rule.two : rule.single);
      if (d.roof) quoteOnly.push("Roof spray-wash (quoted on site)");
      break;
    }
  }
  return items;
}

export function estimate(services: readonly string[], details: ServiceDetails, config: PricingConfig): Estimate {
  const selected = [...new Set(services)].filter((s): s is ServiceCode => s in SERVICE_BY_CODE);
  const lineItems: LineItem[] = [];
  const quoteOnly: string[] = [];

  for (const code of selected) {
    const rule = config.services[code];
    if (!rule) continue;
    lineItems.push(...priceService(code, rule, details, quoteOnly));
  }

  const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);

  // Apply the single best matching bundle discount.
  let best: { label: string; pct: number } | null = null;
  for (const b of config.bundles) {
    const all = b.requires_all.every((c) => selected.includes(c));
    const any = b.requires_any.length === 0 || b.requires_any.some((c) => selected.includes(c));
    if (all && any && (!best || b.discount_pct > best.pct)) best = { label: b.label, pct: b.discount_pct };
  }
  if (best && subtotal > 0) {
    lineItems.push({ service: "bundle", label: `${best.label} (${best.pct}% off)`, amount: -mul(subtotal, best.pct / 100) });
  }

  const total = lineItems.reduce((sum, li) => sum + li.amount, 0);
  const { low, high, round_to } = config.range;
  return {
    estimate: total,
    low: total > 0 ? roundTo(mul(total, low), round_to) : 0,
    high: total > 0 ? roundTo(mul(total, high), round_to) : 0,
    lineItems,
    quoteOnly,
  };
}

export function formatNzd(dollars: number): string {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD", maximumFractionDigits: 0 }).format(dollars);
}

export function formatRange(low: number, high: number): string {
  return `${formatNzd(low)}–${formatNzd(high)}`;
}
