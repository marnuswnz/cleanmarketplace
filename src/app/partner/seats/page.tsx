import { Badge, ButtonLink, Card } from "@/components/ui";
import { requirePartner } from "@/lib/auth";
import { formatNzd } from "@/lib/pricing/estimate";

const TONE = { trial: "brand", active: "ok", past_due: "danger", cancelled: "neutral" } as const;

export default async function PartnerSeats() {
  const { db, role } = await requirePartner();
  const { data: seats } = await db
    .from("seats")
    .select("id, status, monthly_price_cents, trial_ends_at, paused_reason, created_at, areas(name), service_groups(name)")
    .order("created_at");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Seats &amp; billing</h1>
        {role === "owner" && (
          <ButtonLink href="/partner/billing" variant="secondary" prefetch={false}>
            Manage billing &amp; invoices
          </ButtonLink>
        )}
      </div>
      {(seats ?? []).length === 0 ? (
        <Card><p className="text-ink-2">No seats yet. We&apos;ll add seats once your application is approved.</p></Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {seats!.map((s) => (
            <li key={s.id}>
              <Card>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">
                    {(s.areas as unknown as { name: string }).name} · {(s.service_groups as unknown as { name: string }).name}
                  </p>
                  <Badge tone={TONE[s.status as keyof typeof TONE]}>{s.status.replace("_", " ")}</Badge>
                </div>
                <p className="mt-2 text-sm text-ink-2">{formatNzd(s.monthly_price_cents / 100)}/month incl. GST</p>
                {s.status === "trial" && s.trial_ends_at && (
                  <p className="text-sm text-muted">Free trial until {new Date(s.trial_ends_at).toLocaleDateString("en-NZ")}</p>
                )}
                {s.paused_reason && <p className="mt-1 text-sm text-danger">Paused: {s.paused_reason.replace("_", " ")}</p>}
                {s.status === "past_due" && <p className="mt-1 text-sm text-danger">Payment overdue — leads stop after 7 days.</p>}
              </Card>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-muted">To add or cancel a seat (30 days&apos; notice), contact us. Overflow leads appear as separate items on your invoice.</p>
    </div>
  );
}
