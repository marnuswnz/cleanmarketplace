import "server-only";
import { adminDb } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { smsProvider } from "./sms";
import { sendEmailRaw } from "./email";
import type { Rendered } from "./templates";

export interface Recipient {
  mobile?: string | null;
  email?: string | null;
}

export interface SendContext {
  template: string;
  leadId?: string | null;
  partnerId?: string | null;
}

async function log(ctx: SendContext, channel: "sms" | "email", to: string, ok: boolean, providerId?: string, error?: string) {
  const { error: dbErr } = await adminDb().from("messages").insert({
    lead_id: ctx.leadId ?? null,
    partner_id: ctx.partnerId ?? null,
    channel,
    to,
    template: ctx.template,
    status: ok ? (env.dryRunMessages() ? "dry_run" : "sent") : "failed",
    provider_id: providerId ?? null,
    error: error ?? null,
  });
  if (dbErr) console.error("[messages] log failed", dbErr.message);
}

/**
 * Send a rendered template over every channel it defines that the recipient
 * has an address for. Failures are logged, never thrown — messaging must not
 * break routing or acceptance.
 */
export async function send(to: Recipient, msg: Rendered, ctx: SendContext): Promise<void> {
  const jobs: Promise<void>[] = [];
  if (msg.sms && to.mobile) {
    const mobile = to.mobile;
    jobs.push(
      smsProvider()
        .send(mobile, msg.sms)
        .then((r) => log(ctx, "sms", mobile, r.ok, r.providerId, r.error))
        .catch((e: unknown) => log(ctx, "sms", mobile, false, undefined, String(e))),
    );
  }
  if (msg.email && to.email) {
    const email = to.email;
    jobs.push(
      sendEmailRaw({ to: email, ...msg.email })
        .then((r) => log(ctx, "email", email, r.ok, r.providerId, r.error))
        .catch((e: unknown) => log(ctx, "email", email, false, undefined, String(e))),
    );
  }
  await Promise.all(jobs);
}

export async function sendAdmin(msg: Rendered, ctx: SendContext): Promise<void> {
  const to = env.adminEmail();
  if (!to) {
    console.warn("[admin-alert] ADMIN_EMAIL not set:", msg.email?.subject);
    return;
  }
  await send({ email: to }, msg, ctx);
}
