import { z } from "zod";
import { SERVICE_CODES } from "@/lib/catalog";
import { serviceDetailsSchema } from "@/lib/pricing/schema";

/**
 * Normalise an NZ mobile number to E.164 (+642XXXXXXXX).
 * Accepts 02x local format (021 123 4567), +64 / 0064 / 64 prefixes,
 * with spaces, dashes, dots or brackets. Returns null if not an NZ mobile.
 */
export function normalizeNzMobile(input: string): string | null {
  let s = input.trim().replace(/[\s\-().]/g, "");
  if (s.startsWith("+64")) s = s.slice(3);
  else if (s.startsWith("0064")) s = s.slice(4);
  else if (s.startsWith("64") && s.length >= 10) s = s.slice(2);
  else if (s.startsWith("0")) s = s.slice(1);
  else return null;
  if (s.startsWith("0")) s = s.slice(1); // "+64 021..." typo
  return /^2\d{7,9}$/.test(s) ? `+64${s}` : null;
}

export function formatNzMobile(e164: string): string {
  const local = e164.replace(/^\+64/, "0");
  return local.replace(/^(\d{3})(\d{3})(\d+)$/, "$1 $2 $3");
}

export const nzMobile = z
  .string()
  .trim()
  .min(1, "Enter your mobile number")
  .transform((v, ctx) => {
    const n = normalizeNzMobile(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "Enter a valid NZ mobile number, e.g. 021 123 4567" });
      return z.NEVER;
    }
    return n;
  });

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");

export const serviceCodeSchema = z.enum(SERVICE_CODES);

export const estimateRequestSchema = z.object({
  services: z.array(serviceCodeSchema).min(1).max(SERVICE_CODES.length),
  details: serviceDetailsSchema,
});

export const leadRequestSchema = z
  .object({
    suburb: z.string().trim().min(1, "Choose your suburb").max(80),
    services: z.array(serviceCodeSchema).min(1, "Choose at least one service").max(SERVICE_CODES.length),
    details: serviceDetailsSchema,
    preferredDate: isoDate.nullish(),
    flexible: z.boolean().default(false),
    name: z.string().trim().min(1, "Enter your name").max(80),
    mobile: nzMobile,
    email: z.union([z.literal(""), z.email("Enter a valid email")]).nullish().transform((v) => v || null),
    notes: z.string().trim().max(1000).nullish().transform((v) => v || null),
    photoPaths: z
      .array(z.string().regex(/^pending\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|heic)$/i))
      .max(5)
      .default([]),
    consent: z.literal(true, { error: "Please agree so we can share your details with up to 2 businesses" }),
    turnstileToken: z.string().max(4096).optional(),
    utm: z.record(z.string(), z.string().max(200)).optional(),
    website: z.string().max(0).optional(), // honeypot
  })
  .superRefine((v, ctx) => {
    for (const code of v.services) {
      if (!v.details[code]) ctx.addIssue({ code: "custom", path: ["details", code], message: "Missing job details" });
    }
    if (v.preferredDate) {
      const d = new Date(`${v.preferredDate}T00:00:00Z`).getTime();
      const today = Date.now() - 36 * 3600_000; // allow for NZ timezone
      if (Number.isNaN(d) || d < today || d > Date.now() + 366 * 86_400_000) {
        ctx.addIssue({ code: "custom", path: ["preferredDate"], message: "Choose a date in the next 12 months" });
      }
    }
  });
export type LeadRequest = z.infer<typeof leadRequestSchema>;

export const waitlistSchema = z.object({
  email: z.email("Enter a valid email"),
  suburb: z.string().trim().max(80).optional(),
  service: z.string().trim().max(40).optional(),
});

export const feedbackSchema = z.object({
  contacted: z.boolean(),
  booked: z.boolean().nullable(),
  rating: z.number().int().min(1).max(5).nullable(),
  comment: z.string().trim().max(1000).nullish(),
});

export const partnerApplicationSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  nzbn: z
    .string()
    .trim()
    .regex(/^94\d{11}$/, "NZBN is 13 digits starting with 94")
    .or(z.literal(""))
    .transform((v) => v || null),
  contactName: z.string().trim().min(1).max(80),
  email: z.email(),
  mobile: nzMobile,
  services: z.array(serviceCodeSchema).min(1, "Choose at least one service"),
  areas: z.array(z.string()).min(1, "Choose at least one area"),
  gbpUrl: z.union([z.literal(""), z.url()]).transform((v) => v || null),
  description: z.string().trim().max(1000).optional(),
  insuranceExpiry: isoDate.optional().or(z.literal("")),
  agree: z.literal(true, { error: "Please accept the partner terms" }),
});
