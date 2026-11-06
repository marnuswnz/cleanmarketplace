import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadDetails } from "@/components/lead-details";
import { Alert, Badge, Button, Card, Select } from "@/components/ui";
import { cancelLead, cancelOffer, manualOffer, markSpam, rerouteLead } from "@/lib/admin-actions";
import { LEAD_TONE, fmtDateTime } from "@/lib/admin-ui";
import { requireAdmin } from "@/lib/auth";
import { formatRange } from "@/lib/pricing/estimate";
import { formatNzMobile } from "@/lib/validation";

export default async function AdminLead({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const { db } = await requireAdmin();
  const { data: lead } = await db.from("leads").select("*, suburbs(name), areas(name, code)").eq("id", id).maybeSingle();
  if (!lead) notFound();
  const [{ data: offers }, { data: messages }, { data: feedback }, { data: groups }, { data: partners }, { data: log }] = await Promise.all([
    db.from("lead_offers").select("id, status, kind, round, offered_at, expires_at, responded_at, notified_at, outcome, price_cents, partners(id, business_name), service_groups(code)").eq("lead_id", id).order("offered_at"),
    db.from("messages").select("channel, to, template, status, error, created_at").eq("lead_id", id).order("created_at"),
    db.from("feedback").select("*").eq("lead_id", id).maybeSingle(),
    db.from("service_groups").select("id, code, name").order("sort"),
    db.from("partners").select("id, business_name").eq("status", "approved").order("business_name"),
    db.from("audit_log").select("actor, action, created_at").eq("entity_id", id).order("created_at"),
  ]);
  const closed = lead.status === "closed" || lead.status === "spam";

  return (
    <div className="space-y-6">
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Lead {lead.ref_code}</h1>
        <Badge tone={LEAD_TONE[lead.status as keyof typeof LEAD_TONE]}>{lead.status}</Badge>
        {(lead.unrouted_groups ?? []).length > 0 && <Badge tone="danger">unrouted: {lead.unrouted_groups.join(", ")}</Badge>}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="space-y-4">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <p><span className="text-muted">Customer:</span> {lead.customer_name ?? "purged"}</p>
            <p><span className="text-muted">Mobile:</span> {lead.customer_mobile ? formatNzMobile(lead.customer_mobile) : "—"}</p>
            <p><span className="text-muted">Email:</span> {lead.customer_email ?? "—"}</p>
            <p><span className="text-muted">Suburb:</span> {lead.suburbs?.name} ({lead.areas?.code})</p>
            <p><span className="text-muted">Estimate:</span> {lead.est_low_cents ? formatRange(lead.est_low_cents / 100, lead.est_high_cents / 100) : "—"}</p>
            <p><span className="text-muted">Preferred:</span> {lead.preferred_date ?? "—"} {lead.flexible ? "(flexible)" : ""}</p>
            <p><span className="text-muted">Created:</span> {fmtDateTime(lead.created_at)}</p>
            <p><span className="text-muted">Consent:</span> {fmtDateTime(lead.consent_at)}</p>
          </div>
          <LeadDetails services={lead.services} details={lead.details} />
          {lead.notes && <Alert>{lead.notes}</Alert>}
          <details className="text-xs text-muted">
            <summary>Source</summary>
            <pre className="mt-2 overflow-x-auto">{JSON.stringify(lead.source, null, 2)}</pre>
          </details>
        </Card>
        <Card className="space-y-4">
          <h2 className="font-semibold">Actions</h2>
          {!closed && (
            <div className="flex flex-wrap gap-2">
              <form action={rerouteLead}><input type="hidden" name="leadId" value={id} /><Button size="sm">Re-route</Button></form>
              <form action={cancelLead}><input type="hidden" name="leadId" value={id} /><Button size="sm" variant="secondary">Close</Button></form>
              <form action={markSpam}><input type="hidden" name="leadId" value={id} /><Button size="sm" variant="danger">Mark spam</Button></form>
            </div>
          )}
          {!closed && (
            <form action={manualOffer} className="space-y-2 border-t border-line pt-4">
              <p className="text-sm font-semibold">Offer to a partner manually</p>
              <input type="hidden" name="leadId" value={id} />
              <Select name="partnerId" required aria-label="Partner">
                {(partners ?? []).map((p) => <option key={p.id} value={p.id}>{p.business_name}</option>)}
              </Select>
              <Select name="groupId" required aria-label="Service group">
                {(groups ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </Select>
              <Button size="sm" variant="secondary">Send offer</Button>
              <p className="text-xs text-muted">Billed as overflow if the partner has no seat in this area/group. Max 2 live offers per group still applies.</p>
            </form>
          )}
        </Card>
      </div>

      <section>
        <h2 className="mb-2 font-semibold">Offers</h2>
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-surface-2"><tr><th className="p-3">Partner</th><th className="p-3">Group</th><th className="p-3">Kind</th><th className="p-3">Offered</th><th className="p-3">Notified</th><th className="p-3">Responded</th><th className="p-3">Status</th><th className="p-3" /></tr></thead>
            <tbody>
              {(offers ?? []).map((o) => (
                <tr key={o.id} className="border-t border-line">
                  <td className="p-3"><Link className="text-brand underline" href={`/admin/partners/${(o.partners as unknown as { id: string }).id}`}>{(o.partners as unknown as { business_name: string }).business_name}</Link></td>
                  <td className="p-3">{(o.service_groups as unknown as { code: string }).code}</td>
                  <td className="p-3">{o.kind}{o.kind === "overflow" ? ` r${o.round}` : ""}</td>
                  <td className="p-3">{fmtDateTime(o.offered_at)}</td>
                  <td className="p-3">{fmtDateTime(o.notified_at)}</td>
                  <td className="p-3">{fmtDateTime(o.responded_at)}</td>
                  <td className="p-3">{o.status}{o.outcome ? ` · ${o.outcome}` : ""}</td>
                  <td className="p-3">
                    {o.status === "offered" && (
                      <form action={cancelOffer}><input type="hidden" name="offerId" value={o.id} /><input type="hidden" name="leadId" value={id} /><button className="text-danger underline">Cancel</button></form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 font-semibold">Messages</h2>
          <Card className="text-sm">
            <ul className="space-y-1">
              {(messages ?? []).map((m, i) => (
                <li key={i}>{fmtDateTime(m.created_at)} · {m.channel} · {m.template} → {m.to} · <span className={m.status === "failed" ? "text-danger" : ""}>{m.status}</span>{m.error ? ` (${m.error})` : ""}</li>
              ))}
            </ul>
          </Card>
        </section>
        <section>
          <h2 className="mb-2 font-semibold">Feedback &amp; audit</h2>
          <Card className="space-y-3 text-sm">
            {feedback ? (
              <p>Contacted: {String(feedback.contacted)} · Booked: {String(feedback.booked)} · Rating: {feedback.rating ?? "—"} {feedback.comment ? `· “${feedback.comment}”` : ""}</p>
            ) : (
              <p className="text-muted">No feedback yet.</p>
            )}
            <ul className="space-y-1 text-xs text-muted">
              {(log ?? []).map((a, i) => <li key={i}>{fmtDateTime(a.created_at)} · {a.actor} · {a.action}</li>)}
            </ul>
          </Card>
        </section>
      </div>
    </div>
  );
}
