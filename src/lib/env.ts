/**
 * Typed access to environment configuration. Values are read lazily so the
 * app can build without secrets; a missing required secret throws at the
 * point of use with a clear message.
 */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}
const int = (name: string, def: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && process.env[name] !== "" && process.env[name] !== undefined ? n : def;
};
const bool = (name: string, def: boolean) => {
  const v = process.env[name];
  return v === undefined || v === "" ? def : v === "true" || v === "1";
};

export const env = {
  siteUrl: () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  stripeSecret: () => required("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: () => required("STRIPE_WEBHOOK_SECRET"),
  stripePriceStandard: () => required("STRIPE_PRICE_SEAT_STANDARD"),
  stripePriceLarge: () => required("STRIPE_PRICE_SEAT_LARGE"),
  stripeConfigured: () => Boolean(process.env.STRIPE_SECRET_KEY),
  smsProvider: () => (process.env.SMS_PROVIDER ?? "twilio") as "twilio" | "clicksend",
  twilioSid: () => required("TWILIO_ACCOUNT_SID"),
  twilioToken: () => required("TWILIO_AUTH_TOKEN"),
  twilioFrom: () => required("TWILIO_FROM"),
  clicksendUser: () => required("CLICKSEND_USERNAME"),
  clicksendKey: () => required("CLICKSEND_API_KEY"),
  clicksendFrom: () => process.env.CLICKSEND_FROM,
  resendKey: () => required("RESEND_API_KEY"),
  emailFrom: () => process.env.EMAIL_FROM ?? "Quotes <quotes@example.com>",
  adminEmail: () => process.env.ADMIN_EMAIL ?? "",
  cronSecret: () => required("CRON_SECRET"),
  turnstileSiteKey: () => process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? process.env.TURNSTILE_SITE_KEY ?? "",
  turnstileSecret: () => process.env.TURNSTILE_SECRET_KEY ?? "",
  offerTtlMinutes: () => int("OFFER_TTL_MINUTES", 30),
  maxPartnersPerLead: () => int("MAX_PARTNERS_PER_LEAD", 2),
  maxSeatsPerCell: () => int("MAX_SEATS_PER_CELL", 2),
  overflowPriceCents: () => int("OVERFLOW_PRICE_CENTS", 2000),
  foundingTrialDays: () => int("FOUNDING_TRIAL_DAYS", 60),
  dryRunMessages: () => bool("DRY_RUN_MESSAGES", process.env.NODE_ENV !== "production"),
};

export const routingConfig = () => ({
  maxPartners: env.maxPartnersPerLead(),
  offerTtlMinutes: env.offerTtlMinutes(),
  maxOverflowRounds: 2,
});
