import { revalidatePath } from "next/cache";
import { Alert, Button, Card, Field, Input, Textarea } from "@/components/ui";
import { requirePartner } from "@/lib/auth";
import { env } from "@/lib/env";
import { sendAdmin } from "@/lib/messaging";
import { adminAlert } from "@/lib/messaging/templates";
import { adminDb } from "@/lib/supabase/admin";
import { normalizeNzMobile } from "@/lib/validation";
import { audit } from "@/lib/audit";

async function saveProfile(formData: FormData) {
  "use server";
  const { db, partner } = await requirePartner();
  const url = (v: FormDataEntryValue | null) => {
    const s = String(v ?? "").trim();
    return /^https:\/\/\S+$/.test(s) ? s : null;
  };
  const mobile = normalizeNzMobile(String(formData.get("mobile") ?? ""));
  // User client: column grants allow only these profile fields.
  await db
    .from("partners")
    .update({
      contact_name: String(formData.get("contact_name") ?? partner.contact_name).slice(0, 80),
      ...(mobile ? { mobile } : {}),
      description: String(formData.get("description") ?? "").slice(0, 1000) || null,
      gbp_url: url(formData.get("gbp_url")),
      logo_url: url(formData.get("logo_url")),
    })
    .eq("id", partner.id);
  revalidatePath("/partner/profile");
}

async function uploadInsurance(formData: FormData) {
  "use server";
  const { db, partner } = await requirePartner();
  const file = formData.get("doc");
  const expiry = String(formData.get("expiry") ?? "");
  if (!(file instanceof File) || file.size === 0 || file.size > 4 * 1024 * 1024) return;
  const ext = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" }[file.type];
  if (!ext) return;
  const path = `${partner.id}/insurance-${Date.now()}.${ext}`;
  const { error } = await adminDb().storage.from("insurance-docs").upload(path, file, { contentType: file.type });
  if (error) return;
  await db.from("partners").update({ insurance_doc_path: path }).eq("id", partner.id);
  await audit(`partner:${partner.id}`, "partner.insurance_uploaded", "partner", partner.id, { path, declared_expiry: expiry });
  // Expiry is only updated by an admin after checking the certificate.
  await sendAdmin(
    adminAlert(`Insurance renewal uploaded: ${partner.business_name}`, [`Declared expiry: ${expiry || "not given"}`, "Verify the certificate and update the expiry date."], `${env.siteUrl()}/admin/partners/${partner.id}`),
    { template: "admin_insurance_uploaded", partnerId: partner.id },
  );
  revalidatePath("/partner/profile");
}

export default async function PartnerProfile() {
  const { partner } = await requirePartner();
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>
      <Card>
        <form action={saveProfile} className="space-y-4">
          <p className="text-sm text-muted">Business name and NZBN changes: contact us.</p>
          <Field label="Contact name" htmlFor="contact_name">
            <Input id="contact_name" name="contact_name" defaultValue={partner.contact_name} required />
          </Field>
          <Field label="Mobile for lead SMS" htmlFor="mobile">
            <Input id="mobile" name="mobile" type="tel" defaultValue={partner.mobile} required />
          </Field>
          <Field label="About your business" htmlFor="description" hint="Shown to customers whose request you accept.">
            <Textarea id="description" name="description" defaultValue={partner.description ?? ""} maxLength={1000} />
          </Field>
          <Field label="Google Business Profile URL" htmlFor="gbp_url">
            <Input id="gbp_url" name="gbp_url" type="url" defaultValue={partner.gbp_url ?? ""} />
          </Field>
          <Field label="Logo URL" htmlFor="logo_url">
            <Input id="logo_url" name="logo_url" type="url" defaultValue={partner.logo_url ?? ""} />
          </Field>
          <Button type="submit">Save profile</Button>
        </form>
      </Card>
      <Card>
        <h2 className="font-semibold">Insurance</h2>
        <p className="mt-1 text-sm text-ink-2">
          Expiry on file: <strong>{partner.insurance_expiry ?? "none"}</strong>
          {partner.insurance_doc_path ? " · certificate uploaded" : ""}
        </p>
        {!partner.insurance_expiry && <Alert tone="warn" className="mt-3">You need current insurance on file to receive leads.</Alert>}
        <form action={uploadInsurance} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="New certificate" htmlFor="doc" hint="PDF, JPG or PNG, max 4 MB.">
            <Input id="doc" name="doc" type="file" accept="application/pdf,image/jpeg,image/png" required />
          </Field>
          <Field label="New expiry date" htmlFor="expiry">
            <Input id="expiry" name="expiry" type="date" required />
          </Field>
          <Button type="submit" variant="secondary" className="sm:col-span-2 sm:justify-self-start">Upload renewal</Button>
        </form>
      </Card>
    </div>
  );
}
