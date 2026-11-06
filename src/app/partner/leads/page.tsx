import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { requirePartner } from "@/lib/auth";
import { serviceList } from "@/lib/messaging/templates";
import { partnerOffers } from "@/lib/partner-data";
import { formatRange } from "@/lib/pricing/estimate";

const TONE = { offered: "brand", accepted: "ok", declined: "neutral", expired: "neutral", cancelled: "neutral" } as const;
const fmt = (d: string) => new Date(d).toLocaleString("en-NZ", { timeZone: "Pacific/Auckland", dateStyle: "medium", timeStyle: "short" });

export default async function PartnerLeads() {
  const { db } = await requirePartner();
  const offers = await partnerOffers(db);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Leads</h1>
      {offers.length === 0 ? (
        <Card><p className="text-ink-2">No leads yet.</p></Card>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-surface-2">
              <tr>
                <th className="p-3">Received</th>
                <th className="p-3">Ref</th>
                <th className="p-3">Job</th>
                <th className="p-3">Estimate</th>
                <th className="p-3">Status</th>
                <th className="p-3">Customer</th>
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => (
                <tr key={o.offer_id} className="border-t border-line align-top">
                  <td className="p-3 whitespace-nowrap">{fmt(o.offered_at)}</td>
                  <td className="p-3 font-mono text-xs">{o.ref_code}</td>
                  <td className="p-3">
                    {serviceList(o.services)}
                    <span className="block text-muted">{o.suburb_name}</span>
                  </td>
                  <td className="p-3 whitespace-nowrap">{o.est_low_cents && o.est_high_cents ? formatRange(o.est_low_cents / 100, o.est_high_cents / 100) : "—"}</td>
                  <td className="p-3">
                    <Badge tone={TONE[o.status]}>{o.status}</Badge>
                    {o.kind === "overflow" && <Badge tone="warn" className="ml-1">overflow</Badge>}
                    {o.outcome && <span className="mt-1 block text-xs text-muted">{o.outcome.replace("_", " ")}</span>}
                  </td>
                  <td className="p-3">
                    {o.status === "accepted" ? (
                      <Link href={`/partner/leads/${o.lead_id}`} className="text-brand underline">{o.customer_name}</Link>
                    ) : o.status === "offered" && o.token ? (
                      <Link href={`/offer/${o.token}`} className="text-brand underline">Respond</Link>
                    ) : (
                      <span className="text-muted">Hidden</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
