import Link from "next/link";
import { Badge } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { LEAD_TONE, fmtDateTime } from "@/lib/admin-ui";
import { serviceList } from "@/lib/messaging/templates";
import { formatRange } from "@/lib/pricing/estimate";

const STATUSES = ["all", "new", "routing", "offered", "accepted", "unrouted", "closed", "spam"] as const;

export default async function AdminLeads({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status = "all", q } = await searchParams;
  const { db } = await requireAdmin();
  let query = db
    .from("leads")
    .select("id, ref_code, services, status, created_at, est_low_cents, est_high_cents, customer_name, unrouted_groups, suburbs(name), lead_offers(status)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status !== "all") query = query.eq("status", status);
  if (q) query = query.or(`ref_code.ilike.%${q.replace(/[%,()]/g, "")}%,customer_mobile.ilike.%${q.replace(/[^0-9+]/g, "")}%`);
  const { data: leads } = await query;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">Leads</h1>
        <form className="flex gap-2">
          <input type="hidden" name="status" value={status} />
          <input name="q" defaultValue={q} placeholder="Ref or mobile" className="rounded-lg border border-line bg-surface px-3 py-2 text-sm" />
          <button className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white">Search</button>
        </form>
      </div>
      <nav className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link key={s} href={`/admin/leads?status=${s}`} className={`rounded-full border px-3 py-1 text-sm ${s === status ? "border-brand bg-brand-soft text-brand-2" : "border-line bg-surface"}`}>
            {s}
          </Link>
        ))}
      </nav>
      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-surface-2">
            <tr>
              <th className="p-3">Created</th>
              <th className="p-3">Ref</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Job</th>
              <th className="p-3">Estimate</th>
              <th className="p-3">Offers</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(leads ?? []).map((l) => {
              const offers = (l.lead_offers as { status: string }[]) ?? [];
              return (
                <tr key={l.id} className="border-t border-line">
                  <td className="p-3 whitespace-nowrap">{fmtDateTime(l.created_at)}</td>
                  <td className="p-3"><Link href={`/admin/leads/${l.id}`} className="font-mono text-xs text-brand underline">{l.ref_code}</Link></td>
                  <td className="p-3">{l.customer_name ?? <span className="text-muted">purged</span>}</td>
                  <td className="p-3">{serviceList(l.services)}<span className="block text-muted">{(l.suburbs as unknown as { name: string }).name}</span></td>
                  <td className="p-3 whitespace-nowrap">{l.est_low_cents && l.est_high_cents ? formatRange(l.est_low_cents / 100, l.est_high_cents / 100) : "—"}</td>
                  <td className="p-3 text-xs">
                    {offers.filter((o) => o.status === "accepted").length} acc · {offers.filter((o) => o.status === "offered").length} open · {offers.length} total
                  </td>
                  <td className="p-3">
                    <Badge tone={LEAD_TONE[l.status as keyof typeof LEAD_TONE]}>{l.status}</Badge>
                    {(l.unrouted_groups ?? []).length > 0 && l.status !== "unrouted" && <Badge tone="danger" className="ml-1">{l.unrouted_groups.join(",")}</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
