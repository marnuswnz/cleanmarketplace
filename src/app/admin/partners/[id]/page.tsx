import { notFound } from "next/navigation";
import { Alert, Badge, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { addSeat, cancelSeat, setPartnerStatus, updatePartnerAdmin } from "@/lib/admin-actions";
import { PARTNER_TONE, SEAT_TONE, fmtDateTime, pct } from "@/lib/admin-ui";
import { requireAdmin } from "@/lib/auth";
import { formatNzd } from "@/lib/pricing/estimate";
import { adminDb } from "@/lib/supabase/admin";

export default async function AdminPartner({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const { db } = await requireAdmin();
  const { data: p } = await db.from("partners").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  const [{ data: seats }, { data: areas }, { data: groups }, { data: users }, { data: offers }] = await Promise.all([
    db.from("seats").select("id, status, priority, monthly_price_cents, trial_ends_at, past_due_since, paused_reason, stripe_subscription_item_id, areas(name), service_groups(name)").eq("partner_id", id).order("created_at"),
    db.from("areas").select("id, name").order("sort"),
    db.from("service_groups").select("id, name").order("sort"),
    db.from("partner_users").select("user_id, role").eq("partner_id", id),
    db.from("lead_offers").select("status").eq("partner_id", id),
  ]);
  const doc = p.insurance_doc_path ? (await adminDb().storage.from("insurance-docs").createSignedUrl(p.insurance_doc_path, 600)).data?.signedUrl : null;
  const hidden = <input type="hidden" name="partnerId" value={id} />;

  return (
    <div className="space-y-6">
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{p.business_name}</h1>
        <Badge tone={PARTNER_TONE[p.status as keyof typeof PARTNER_TONE]}>{p.status}</Badge>
        {p.founding && <Badge tone="brand">founding</Badge>}
        {p.flagged_at && <Badge tone="danger">flagged: {p.flag_reason}</Badge>}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-2 text-sm">
          <p><span className="text-muted">Contact:</span> {p.contact_name} · {p.email} · {p.mobile}</p>
          <p><span className="text-muted">NZBN:</span> {p.nzbn ?? "—"} {p.nzbn && <a className="text-brand underline" href={`https://www.nzbn.govt.nz/mynzbn/search/${p.nzbn}/`} target="_blank" rel="noopener">verify</a>}</p>
          <p><span className="text-muted">Reviews:</span> {p.gbp_url ? <a className="text-brand underline" href={p.gbp_url} target="_blank" rel="noopener">Google profile</a> : "—"}</p>
          <p><span className="text-muted">Insurance doc:</span> {doc ? <a className="text-brand underline" href={doc} target="_blank" rel="noopener">view certificate</a> : "none"}</p>
          <p><span className="text-muted">Applied for:</span> {(p.applied_services ?? []).join(", ") || "—"} in {(p.applied_areas ?? []).join(", ") || "—"}</p>
          <p><span className="text-muted">Users:</span> {(users ?? []).length} linked</p>
          <p><span className="text-muted">Metrics:</span> accept {pct(p.accept_rate)} · response {p.avg_response_mins ? `${Math.round(Number(p.avg_response_mins))}m` : "—"} · rating {p.avg_rating ?? "—"} · contacted {pct(p.contact_rate)} · {(offers ?? []).length} offers</p>
          <p><span className="text-muted">Stripe:</span> {p.stripe_customer_id ?? "—"} / {p.stripe_subscription_id ?? "—"}</p>
          {p.description && <p className="pt-2 text-ink-2">{p.description}</p>}
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            {(["approved", "suspended", "churned"] as const).filter((s) => s !== p.status).map((s) => (
              <form key={s} action={setPartnerStatus}>
                {hidden}
                <input type="hidden" name="status" value={s} />
                <Button size="sm" variant={s === "approved" ? "primary" : s === "suspended" ? "danger" : "secondary"}>
                  {s === "approved" ? "Approve" : s === "suspended" ? "Suspend" : "Mark churned"}
                </Button>
              </form>
            ))}
          </div>
        </Card>
        <Card>
          <form action={updatePartnerAdmin} className="space-y-4">
            {hidden}
            <Field label="Verified insurance expiry" htmlFor="insurance_expiry" hint="Only set after checking the certificate. Seats pause automatically after this date.">
              <Input id="insurance_expiry" name="insurance_expiry" type="date" defaultValue={p.insurance_expiry ?? ""} />
            </Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="founding" defaultChecked={p.founding} /> Founding partner (60-day trial on new subscriptions)</label>
            {p.flagged_at && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="clear_flag" /> Clear flag</label>}
            <Field label="Admin notes" htmlFor="admin_notes">
              <Textarea id="admin_notes" name="admin_notes" defaultValue={p.admin_notes ?? ""} />
            </Field>
            <Button size="sm">Save</Button>
          </form>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Seats</h2>
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-surface-2"><tr><th className="p-3">Cell</th><th className="p-3">Status</th><th className="p-3">Priority</th><th className="p-3">Price</th><th className="p-3">Trial / past due</th><th className="p-3">Stripe</th><th className="p-3" /></tr></thead>
            <tbody>
              {(seats ?? []).map((s) => (
                <tr key={s.id} className="border-t border-line">
                  <td className="p-3">{(s.areas as unknown as { name: string }).name} · {(s.service_groups as unknown as { name: string }).name}</td>
                  <td className="p-3"><Badge tone={SEAT_TONE[s.status as keyof typeof SEAT_TONE]}>{s.status}</Badge>{s.paused_reason && <Badge tone="danger" className="ml-1">paused</Badge>}</td>
                  <td className="p-3">{s.priority}</td>
                  <td className="p-3">{formatNzd(s.monthly_price_cents / 100)}</td>
                  <td className="p-3 text-xs">{s.trial_ends_at ? `trial → ${fmtDateTime(s.trial_ends_at)}` : ""}{s.past_due_since ? `past due since ${fmtDateTime(s.past_due_since)}` : ""}</td>
                  <td className="p-3 font-mono text-xs">{s.stripe_subscription_item_id ?? "—"}</td>
                  <td className="p-3">
                    {s.status !== "cancelled" && (
                      <form action={cancelSeat}>{hidden}<input type="hidden" name="seatId" value={s.id} /><button className="text-danger underline">Cancel</button></form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Card>
          <form action={addSeat} className="grid gap-3 sm:grid-cols-[1fr_1fr_100px_auto] sm:items-end">
            {hidden}
            <Field label="Area" htmlFor="areaId"><Select id="areaId" name="areaId">{(areas ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
            <Field label="Service group" htmlFor="groupId"><Select id="groupId" name="groupId">{(groups ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select></Field>
            <Field label="Priority" htmlFor="priority"><Input id="priority" name="priority" type="number" defaultValue={0} /></Field>
            <Button disabled={p.status !== "approved"}>Add seat</Button>
          </form>
          <p className="mt-2 text-xs text-muted">Max 2 live seats per cell (enforced in the database). Adding a seat adds a subscription item in Stripe.</p>
        </Card>
      </section>
    </div>
  );
}
