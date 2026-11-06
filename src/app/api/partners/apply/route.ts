import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import { send, sendAdmin } from "@/lib/messaging";
import { adminAlert, applicationReceived } from "@/lib/messaging/templates";
import { clientIp, hash, json, rateLimit, zodErrors } from "@/lib/request";
import { adminDb } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";
import { partnerApplicationSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

const MAX_DOC_BYTES = 4 * 1024 * 1024;
const DOC_TYPES: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (ip && !(await rateLimit(`apply:${hash(ip)}`, 3600, 5))) return json({ error: "rate_limited" }, 429);

  const form = await req.formData().catch(() => null);
  if (!form) return json({ error: "invalid" }, 400);
  const parsed = partnerApplicationSchema.safeParse({
    businessName: form.get("businessName"),
    nzbn: form.get("nzbn") ?? "",
    contactName: form.get("contactName"),
    email: form.get("email"),
    mobile: form.get("mobile"),
    services: form.getAll("services"),
    areas: form.getAll("areas"),
    gbpUrl: form.get("gbpUrl") ?? "",
    description: form.get("description") ?? undefined,
    insuranceExpiry: form.get("insuranceExpiry") ?? "",
    agree: form.get("agree") === "on" || form.get("agree") === "true",
  });
  if (!parsed.success) return json({ error: "invalid", fields: zodErrors(parsed.error.issues) }, 400);
  if (!(await verifyTurnstile((form.get("cf-turnstile-response") as string) ?? undefined, ip))) {
    return json({ error: "captcha", message: "Please complete the verification." }, 400);
  }

  const doc = form.get("insuranceDoc");
  const db = adminDb();
  const a = parsed.data;
  const partnerId = randomUUID();
  let docPath: string | null = null;

  if (doc instanceof File && doc.size > 0) {
    const ext = DOC_TYPES[doc.type];
    if (!ext || doc.size > MAX_DOC_BYTES) {
      return json({ error: "invalid", fields: { insuranceDoc: "Upload a PDF, JPG or PNG under 4 MB" } }, 400);
    }
    docPath = `${partnerId}/insurance-${Date.now()}.${ext}`;
    const { error } = await db.storage.from("insurance-docs").upload(docPath, doc, { contentType: doc.type });
    if (error) return json({ error: "server", message: "Upload failed" }, 500);
  }

  const { error } = await db.from("partners").insert({
    id: partnerId,
    business_name: a.businessName,
    nzbn: a.nzbn,
    contact_name: a.contactName,
    email: a.email.toLowerCase(),
    mobile: a.mobile,
    gbp_url: a.gbpUrl,
    description: a.description ?? null,
    insurance_doc_path: docPath,
    // Applicant-declared; verified by admin against the certificate before approval.
    insurance_expiry: a.insuranceExpiry || null,
    applied_services: a.services,
    applied_areas: a.areas,
    status: "applied",
  });
  if (error) return json({ error: "server" }, 500);

  await audit("public", "partner.applied", "partner", partnerId, { business: a.businessName });
  await send({ email: a.email }, applicationReceived({ contactName: a.contactName }), { template: "partner_application_received", partnerId });
  await sendAdmin(
    adminAlert(`New partner application: ${a.businessName}`, [`${a.contactName} · ${a.email} · ${a.mobile}`, `Services: ${a.services.join(", ")}`, `Areas: ${a.areas.join(", ")}`], `${env.siteUrl()}/admin/partners/${partnerId}`),
    { template: "admin_partner_applied", partnerId },
  );
  return json({ ok: true }, 201);
}
