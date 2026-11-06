import Link from "next/link";
import { Badge, Card, Stat } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { fmtDateTime } from "@/lib/admin-ui";
import { requestTime } from "@/lib/time";
import { serviceList } from "@/lib/messaging/templates";

export default async function AdminHome() {
  const { db } = await requireAdmin();
  const t = requestTime();
  const day = new Date(t - 86_400_000).toISOString();
  const week = new Date(t - 7 * 86_400_000).toISOString();
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const [leads24, leads7, unroutedN, openOffers, applied, waitlist] = await Promise.all([
    count(db.from("leads").select("id", { count: "exact", head: true }).gte("created_at", day)),
    count(db.from("leads").select("id", { count: "exact", head: true }).gte("created_at", week)),
    count(db.from("leads").select("id", { count: "exact", head: true }).eq("status", "unrouted")),
    count(db.from("lead_offers").select("id", { count: "exact", head: true }).eq("status", "offered")),
    count(db.from("partners").select("id", { count: "exact", head: true }).eq("status", "applied")),
    count(db.from("waitlist").select("id", { count: "exact", head: true })),
  ]);
  const { data: attention } = await db
    .from("leads")
    .select("id, ref_code, services, status, created_at, unrouted_groups, suburbs(name)")
    .or("status.eq.unrouted,unrouted_groups.neq.{}")
    .not("status", "in", "(closed,spam)")
    .order("created_at", { ascending: false })
    .limit(10);
  const { data: flagged } = await db.from("partners").select("id, business_name, flag_reason, flagged_at").not("flagged_at", "is", null).order("flagged_at", { ascending: false }).limit(10);
  const { data: waitlistRows } = await db.from("waitlist").select("email, suburb_text, service, created_at").order("created_at", { ascending: false }).limit(10);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Overview</h1>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Leads 24h" value={leads24} />
        <Stat label="Leads 7d" value={leads7} />
        <Stat label="Unrouted" value={unroutedN} />
        <Stat label="Open offers" value={openOffers} />
        <Stat label="Applications" value={applied} />
        <Stat label="Waitlist" value={waitlist} />
      </div>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Needs attention</h2>
        <Card className="p-0 sm:p-0">
          {(attention ?? []).length === 0 ? (
            <p className="p-5 text-ink-2">Nothing unrouted. 🎉</p>
          ) : (
            <ul className="divide-y divide-line">
              {attention!.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <Link href={`/admin/leads/${l.id}`} className="font-medium text-brand underline">{l.ref_code}</Link>
                  <span className="text-sm">{serviceList(l.services)} · {(l.suburbs as unknown as { name: string }).name}</span>
                  <span className="text-sm text-muted">{fmtDateTime(l.created_at)}</span>
                  <Badge tone="danger">unrouted: {(l.unrouted_groups ?? []).join(", ") || "all"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Flagged partners</h2>
          <Card>
            {(flagged ?? []).length === 0 ? (
              <p className="text-ink-2">None.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {flagged!.map((p) => (
                  <li key={p.id}>
                    <Link href={`/admin/partners/${p.id}`} className="font-medium text-brand underline">{p.business_name}</Link> — {p.flag_reason}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold">Latest waitlist</h2>
          <Card>
            {(waitlistRows ?? []).length === 0 ? (
              <p className="text-ink-2">Empty.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {waitlistRows!.map((w, i) => (
                  <li key={i}>{w.email} · {w.suburb_text ?? "?"} · {w.service ?? ""}</li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}
