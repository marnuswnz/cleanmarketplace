import { describe, expect, it } from "vitest";
import { estimate } from "@/lib/pricing/estimate";
import { DEFAULT_PRICING, configToRows } from "@/lib/pricing/defaults";
import { parseRuleForKey, pricingConfigSchema } from "@/lib/pricing/schema";

const cfg = DEFAULT_PRICING;
const total = (services: string[], details: Parameters<typeof estimate>[1]) => estimate(services, details, cfg).estimate;

describe("estimate — end_of_tenancy", () => {
  it.each([
    [1, 280],
    [2, 360],
    [3, 450],
    [4, 560],
    [5, 680],
    [8, 680],
  ])("%i bedrooms → $%i", (bedrooms, price) => {
    expect(total(["end_of_tenancy"], { end_of_tenancy: { bedrooms, bathrooms: 1, pets: false } })).toBe(price);
  });

  it("adds $60 per extra bathroom and $40 for pets", () => {
    const e = estimate(["end_of_tenancy"], { end_of_tenancy: { bedrooms: 2, bathrooms: 3, pets: true } }, cfg);
    expect(e.estimate).toBe(360 + 2 * 60 + 40);
    expect(e.lineItems.map((l) => l.amount)).toEqual([360, 120, 40]);
  });

  it("outputs a range of ×0.9 / ×1.15 rounded to $10", () => {
    const e = estimate(["end_of_tenancy"], { end_of_tenancy: { bedrooms: 3, bathrooms: 1, pets: false } }, cfg);
    expect(e).toMatchObject({ estimate: 450, low: 410, high: 520 });
  });
});

describe("estimate — deep_clean", () => {
  it.each([
    [1, 220],
    [2, 290],
    [3, 360],
    [4, 440],
    [5, 520],
  ])("%i bedrooms → $%i", (bedrooms, price) => {
    expect(total(["deep_clean"], { deep_clean: { bedrooms, bathrooms: 2 } })).toBe(price);
  });
});

describe("estimate — carpet_clean", () => {
  it("call-out + per room, hallway counts as a room, stairs extra", () => {
    expect(total(["carpet_clean"], { carpet_clean: { rooms: 3, hallway: true, stairs: true } })).toBe(90 + 4 * 35 + 45);
  });
  it("call-out only when no rooms", () => {
    expect(total(["carpet_clean"], { carpet_clean: { rooms: 0, hallway: false, stairs: false } })).toBe(90);
  });
});

describe("estimate — upholstery_clean", () => {
  it("$45 per seat and $60 per mattress", () => {
    expect(total(["upholstery_clean"], { upholstery_clean: { seats: 3, mattresses: 1 } })).toBe(135 + 60);
    expect(total(["upholstery_clean"], { upholstery_clean: { seats: 0, mattresses: 2 } })).toBe(120);
  });
});

describe("estimate — oven_clean", () => {
  it("single, double, rangehood", () => {
    expect(total(["oven_clean"], { oven_clean: { type: "single", rangehood: false } })).toBe(160);
    expect(total(["oven_clean"], { oven_clean: { type: "double", rangehood: true } })).toBe(260);
  });
});

describe("estimate — window_clean", () => {
  it.each([
    [1, 1, 180],
    [15, 1, 180],
    [16, 1, 280],
    [30, 1, 280],
    [31, 1, 380],
    [20, 2, 364],
    [40, 2, 494],
  ] as const)("%i windows, %i storey → $%i", (windows, storeys, price) => {
    expect(total(["window_clean"], { window_clean: { windows, storeys } })).toBe(price);
  });
});

describe("estimate — house_wash", () => {
  it("single and two storey", () => {
    expect(total(["house_wash"], { house_wash: { storeys: 1, roof: false } })).toBe(380);
    expect(total(["house_wash"], { house_wash: { storeys: 2, roof: false } })).toBe(580);
  });
  it("roof is flagged quote-only and not priced", () => {
    const e = estimate(["house_wash"], { house_wash: { storeys: 1, roof: true } }, cfg);
    expect(e.estimate).toBe(380);
    expect(e.quoteOnly).toHaveLength(1);
  });
});

describe("estimate — bundles", () => {
  const eot = { bedrooms: 3, bathrooms: 1, pets: false };

  it("10% off when end_of_tenancy + carpet_clean", () => {
    const e = estimate(
      ["end_of_tenancy", "carpet_clean"],
      { end_of_tenancy: eot, carpet_clean: { rooms: 3, hallway: true, stairs: false } },
      cfg,
    );
    // 450 + (90 + 4*35) = 680, less 68
    expect(e.estimate).toBe(612);
    expect(e.lineItems.at(-1)).toMatchObject({ service: "bundle", amount: -68 });
    expect(e).toMatchObject({ low: 550, high: 700 });
  });

  it("10% off when end_of_tenancy + oven_clean", () => {
    expect(total(["end_of_tenancy", "oven_clean"], { end_of_tenancy: eot, oven_clean: { type: "single", rangehood: false } })).toBe(549);
  });

  it("no discount without end_of_tenancy", () => {
    expect(
      total(["carpet_clean", "oven_clean"], {
        carpet_clean: { rooms: 2, hallway: false, stairs: false },
        oven_clean: { type: "single", rangehood: false },
      }),
    ).toBe(160 + 160);
  });

  it("no discount for end_of_tenancy + windows", () => {
    expect(total(["end_of_tenancy", "window_clean"], { end_of_tenancy: eot, window_clean: { windows: 10, storeys: 1 } })).toBe(630);
  });

  it("applies only one bundle even if multiple qualifying services are selected", () => {
    const e = estimate(
      ["end_of_tenancy", "carpet_clean", "oven_clean"],
      {
        end_of_tenancy: eot,
        carpet_clean: { rooms: 1, hallway: false, stairs: false },
        oven_clean: { type: "single", rangehood: false },
      },
      cfg,
    );
    expect(e.lineItems.filter((l) => l.service === "bundle")).toHaveLength(1);
    expect(e.estimate).toBe(450 + 125 + 160 - 74);
  });
});

describe("estimate — general", () => {
  it("empty selection is zero", () => {
    expect(estimate([], {}, cfg)).toMatchObject({ estimate: 0, low: 0, high: 0, lineItems: [] });
  });

  it("ignores unknown services and duplicates", () => {
    expect(total(["oven_clean", "oven_clean", "bogus"], { oven_clean: { type: "single", rangehood: false } })).toBe(160);
  });

  it("is deterministic (same inputs → identical output)", () => {
    const args = [["end_of_tenancy", "carpet_clean", "window_clean"], {}, cfg] as const;
    expect(estimate(...args)).toEqual(estimate(...args));
  });

  it("uses default details when details for a service are missing", () => {
    expect(total(["oven_clean"], {})).toBe(160);
  });
});

describe("pricing config validation", () => {
  it("default config is valid", () => {
    expect(() => pricingConfigSchema.parse(DEFAULT_PRICING)).not.toThrow();
  });

  it("every default row validates by key", () => {
    for (const row of configToRows(DEFAULT_PRICING)) {
      expect(() => parseRuleForKey(row.key, row.rule)).not.toThrow();
    }
  });

  it("rejects a rule with the wrong kind for its service", () => {
    expect(() => parseRuleForKey("oven_clean", { kind: "house_wash", single: 1, two: 2 })).toThrow();
  });

  it("rejects window tiers without an open-ended final tier", () => {
    expect(() =>
      parseRuleForKey("window_clean", { kind: "window_tiers", tiers: [{ max: 10, price: 100 }], two_storey_multiplier: 1.3 }),
    ).toThrow();
  });

  it("rejects negative prices", () => {
    expect(() => parseRuleForKey("oven_clean", { kind: "oven", single: -1, double: 1, rangehood: 1 })).toThrow();
  });
});
