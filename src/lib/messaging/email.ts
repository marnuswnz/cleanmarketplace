import { env } from "@/lib/env";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface EmailResult {
  ok: boolean;
  providerId?: string;
  error?: string;
}

export async function sendEmailRaw(msg: EmailMessage): Promise<EmailResult> {
  if (env.dryRunMessages()) {
    console.info(`[email:dry-run] to=${msg.to} subject="${msg.subject}"\n${msg.text}`);
    return { ok: true, providerId: `dry-${Date.now()}` };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.resendKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.emailFrom(),
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      reply_to: msg.replyTo,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  return res.ok ? { ok: true, providerId: json.id } : { ok: false, error: json.message ?? `HTTP ${res.status}` };
}
