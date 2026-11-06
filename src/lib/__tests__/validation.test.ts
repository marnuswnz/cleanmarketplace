import { describe, expect, it } from "vitest";
import { leadRequestSchema, normalizeNzMobile, formatNzMobile } from "@/lib/validation";

describe("NZ mobile validation", () => {
  it.each([
    ["021 123 4567", "+64211234567"],
    ["0211234567", "+64211234567"],
    ["027-123-4567", "+64271234567"],
    ["022 123 45678", "+642212345678"],
    ["+64 21 123 4567", "+64211234567"],
    ["+64 021 123 4567", "+64211234567"],
    ["0064211234567", "+64211234567"],
    ["64211234567", "+64211234567"],
    ["(029) 123-456", "+6429123456"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeNzMobile(input)).toBe(expected);
  });

  it.each(["03 123 4567", "09 123 4567", "+61 412 345 678", "123", "021 12", "abc", "0800 123 456"])("rejects %s", (input) => {
    expect(normalizeNzMobile(input)).toBeNull();
  });

  it("formats for display", () => {
    expect(formatNzMobile("+64211234567")).toBe("021 123 4567");
  });
});

describe("lead request schema", () => {
  const base = {
    suburb: "riccarton",
    services: ["end_of_tenancy", "carpet_clean"],
    details: {
      end_of_tenancy: { bedrooms: 3, bathrooms: 1, pets: false },
      carpet_clean: { rooms: 3, hallway: true, stairs: false },
    },
    name: "Sam",
    mobile: "021 123 4567",
    email: "",
    consent: true,
  };

  it("accepts a valid request and normalises fields", () => {
    const r = leadRequestSchema.parse(base);
    expect(r.mobile).toBe("+64211234567");
    expect(r.email).toBeNull();
    expect(r.flexible).toBe(false);
  });

  it("requires consent", () => {
    expect(leadRequestSchema.safeParse({ ...base, consent: false }).success).toBe(false);
  });

  it("requires details for each selected service", () => {
    expect(leadRequestSchema.safeParse({ ...base, details: { end_of_tenancy: base.details.end_of_tenancy } }).success).toBe(false);
  });

  it("rejects the honeypot", () => {
    expect(leadRequestSchema.safeParse({ ...base, website: "spam" }).success).toBe(false);
  });

  it("rejects unknown services", () => {
    expect(leadRequestSchema.safeParse({ ...base, services: ["pool_clean"] }).success).toBe(false);
  });
});
