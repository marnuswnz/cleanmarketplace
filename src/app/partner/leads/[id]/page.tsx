import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { LeadDetails } from "@/components/lead-details";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";
import { requirePartner } from "@/lib/auth";
import { formatRange } from "@/lib/pricing/estimate";
import { adminDb } from "@/lib/supabase/admin";
import { formatNzMobile } from "@/lib/validation";

async function saveOutcome(formData: FormData) {
  "use server";
  const { db, partner } = await requirePartner();
  const leadId = String(formData.get("leadId"));
  const outcome = String(formData.get("outcome"));
  const price = Number(formData.get("price"));
  if (!["booked", "not_booked", "no_contact"].includes(outcome)) return;
  // RLS + column grants restrict this to outcome/price on this partner's accepted offer.
  await db
    .from("lead_offers")
    .update({ outcome, price_cents: Number.isFinite(price) && price > 0 ? Math.round(price * 100) : null })
    .eq("lead_id", leadId)
    .eq("partner_id", partner.id)
    .eq("status", "accepted");
  revalidatePath(`/partner/leads/${leadId}`);
}

export default async function PartnerLead({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, partner } = await requirePartner();
  // RLS: returns a row only if this partner holds an ACCEPTED offer for the lead.
  const { data: lead } = await db
    .from("leads")
    .select("id, ref_code, services, details, est_low_cents, est_high_cents, preferred_date, flexible, customer_name, customer_mobile, customer_email, notes, photo_paths, suburbs(name)")
    .eq("id", id)
    .maybeSingle();
  if (!lead) notFound();
  const { data: offer } = await db.from("lead_offers").select("outcome, price_cents, kind").eq("lead_id", id).eq("partner_id", partner.id).eq("status", "accepted").maybeSingle();

  const photos = lead.photo_paths?.length
    ? (await adminDb().storage.from("lead-photos").createSignedUrls(lead.photo_paths, 3600)).data ?? []
    : [];

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">
        Lead {lead.ref_code} · {(lead.suburbs as unknown as { name: string } | null)?.name}
      </h1>
      <Card className="space-y-4">
        <div>
          <p className="text-lg font-semibold">{lead.customer_name}</p>
          {lead.customer_mobile && (
            <p>
              <a className="text-brand underline" href={`tel:${lead.customer_mobile}`}>{formatNzMobile(lead.customer_mobile)}</a>
            </p>
          )}
          {lead.customer_email && <p><a className="text-brand underline" href={`mailto:${lead.customer_email}`}>{lead.customer_email}</a></p>}
        </div>
        <p className="text-sm text-ink-2">
          Estimate shown to customer: {lead.est_low_cents && lead.est_high_cents ? formatRange(lead.est_low_cents / 100, lead.est_high_cents / 100) : "—"} ·
          Preferred: {lead.preferred_date ?? "flexible"}
        </p>
        <LeadDetails services={lead.services} details={lead.details} />
        {lead.notes && <Alert>{lead.notes}</Alert>}
        {photos.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {photos.map((p, i) =>
              p.signedUrl ? (
                <li key={i}>
                  <a href={p.signedUrl} target="_blank" rel="noopener" className="text-sm text-brand underline">Photo {i + 1}</a>
                </li>
              ) : null,
            )}
          </ul>
        )}
      </Card>
      <Card>
        <h2 className="font-semibold">Job outcome</h2>
        <form action={saveOutcome} className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <input type="hidden" name="leadId" value={lead.id} />
          <Field label="Did it book?" htmlFor="outcome">
            <Select id="outcome" name="outcome" defaultValue={offer?.outcome ?? ""} required>
              <option value="" disabled>Choose…</option>
              <option value="booked">Booked</option>
              <option value="not_booked">Not booked</option>
              <option value="no_contact">Couldn&apos;t reach customer</option>
            </Select>
          </Field>
          <Field label="Job value (optional, $)" htmlFor="price">
            <Input id="price" name="price" type="number" min={0} step={1} defaultValue={offer?.price_cents ? offer.price_cents / 100 : ""} />
          </Field>
          <Button type="submit">Save</Button>
        </form>
      </Card>
    </div>
  );
}
