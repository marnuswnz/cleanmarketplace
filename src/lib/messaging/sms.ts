import { env } from "@/lib/env";

export interface SmsResult {
  ok: boolean;
  providerId?: string;
  error?: string;
}

/** Swappable SMS transport. */
export interface SmsProvider {
  readonly name: string;
  send(to: string, body: string): Promise<SmsResult>;
}

export class TwilioProvider implements SmsProvider {
  readonly name = "twilio";
  async send(to: string, body: string): Promise<SmsResult> {
    const sid = env.twilioSid();
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${env.twilioToken()}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: env.twilioFrom(), Body: body }),
    });
    const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
    return res.ok ? { ok: true, providerId: json.sid } : { ok: false, error: json.message ?? `HTTP ${res.status}` };
  }
}

export class ClickSendProvider implements SmsProvider {
  readonly name = "clicksend";
  async send(to: string, body: string): Promise<SmsResult> {
    const res = await fetch("https://rest.clicksend.com/v3/sms/send", {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${env.clicksendUser()}:${env.clicksendKey()}`).toString("base64"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: [{ to, body, from: env.clicksendFrom(), source: "nextjs" }] }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      response_msg?: string;
      data?: { messages?: { message_id?: string; status?: string }[] };
    };
    const msg = json.data?.messages?.[0];
    return res.ok && msg?.status === "SUCCESS"
      ? { ok: true, providerId: msg.message_id }
      : { ok: false, error: json.response_msg ?? msg?.status ?? `HTTP ${res.status}` };
  }
}

export class DryRunSmsProvider implements SmsProvider {
  readonly name = "dry-run";
  async send(to: string, body: string): Promise<SmsResult> {
    console.info(`[sms:dry-run] to=${to}\n${body}`);
    return { ok: true, providerId: `dry-${Date.now()}` };
  }
}

export function smsProvider(): SmsProvider {
  if (env.dryRunMessages()) return new DryRunSmsProvider();
  return env.smsProvider() === "clicksend" ? new ClickSendProvider() : new TwilioProvider();
}
