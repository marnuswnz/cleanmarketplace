import { after } from "next/server";
import { env } from "@/lib/env";
import { createLead } from "@/lib/leads";
import { send } from "@/lib/messaging";
import { customerLeadReceived } from "@/lib/messaging/templates";
import { routeLeadById } from "@/lib/offers";
import { clientIp, hash, json, rateLimit, zodErrors } from "@/lib/request";
import { verifyTurnstile } from "@/lib/turnstile";
import { audit } from "@/lib/audit";
import { leadRequestSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = leadRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: "invalid", fields: zodErrors(parsed.error.issues) }, 400);
  const input = parsed.data;

  const ip = clientIp(req);
  const ipHash = ip ? hash(ip) : null;
  if (ipHash && !(await rateLimit(`lead:ip:${ipHash}`, 3600, 6))) {
    return json({ error: "rate_limited", message: "Too many requests — please try again later." }, 429);
  }
  if (!(await rateLimit(`lead:mobile:${hash(input.mobile)}`, 86_400, 4))) {
    return json({ error: "rate_limited", message: "We've already received several requests from this number today." }, 429);
  }
  if (!(await verifyTurnstile(input.turnstileToken, ip))) {
    return json({ error: "captcha", message: "Please complete the verification and try again." }, 400);
  }

  const result = await createLead(input, { ipHash, userAgent: req.headers.get("user-agent") });
  if (result.kind === "unknown_suburb") {
    return json({ error: "unknown_suburb", message: "We don't cover that suburb yet — join the waitlist and we'll let you know." }, 422);
  }
  if (result.kind === "duplicate") {
    return json({ ok: true, duplicate: true, ref: result.ref });
  }

  after(async () => {
    try {
      await routeLeadById(result.id);
    } catch (e) {
      // The expire-offers cron re-routes stuck leads, so this is recoverable.
      console.error("[leads] routing failed", result.id, e);
    }
    await send(
      { email: input.email },
      customerLeadReceived({
        customerName: input.name,
        refCode: result.ref,
        deferred: result.deferred,
        link: `${env.siteUrl()}/quote/sent/${result.ref}`,
      }),
      { template: "customer_lead_received", leadId: result.id },
    );
    await audit("public", "lead.created", "lead", result.id, { ref: result.ref, services: input.services });
  });

  return json({ ok: true, ref: result.ref, deferred: result.deferred }, 201);
}
