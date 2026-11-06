import Link from "next/link";
import { Alert, Badge, ButtonLink, Card, Stat } from "@/components/ui";
import { requirePartner } from "@/lib/auth";
import { serviceList } from "@/lib/messaging/templates";
import { partnerOffers } from "@/lib/partner-data";
import { formatRange } from "@/lib/pricing/estimate";
import { nzDateString, requestTime } from "@/lib/time";

export default async function PartnerHome({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { db, partner } = await requirePartner();
  const offers = await partnerOffers(db);
  const now = requestTime();
  const open = offers.filter((o) => o.status === "offered" && new Date(o.expires_at).getTime() > now);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const acceptedThisMonth = offers.filter((o) => o.status === "accepted" && new Date(o.offered_at).getTime() >= monthStart);
  const { data: seats } = await db.from("seats").select("id, status, paused_reason").neq("status", "cancelled");
  const insuranceSoon = partner.insurance_expiry && partner.insurance_expiry <= nzDateString(new Date(now + 30 * 86_400_000));

  return (
    <div className="space-y-8">
      {error === "billing" && <Alert tone="warn">Only the account owner can manage billing.</Alert>}
      {error === "billing_unconfigured" && <Alert tone="warn">Billing isn&apos;t set up yet — we&apos;ll be in touch.</Alert>}
      {partner.status !== "approved" && <Alert tone="warn">Your account is {partner.status}. You won&apos;t receive new leads until it&apos;s approved.</Alert>}
      {insuranceSoon && (
        <Alert tone="warn">
          Your insurance on file expires {partner.insurance_expiry}. <Link href="/partner/profile" className="underline">Upload your renewal</Link> to keep receiving leads.
        </Alert>
      )}
      {seats?.some((s) => s.paused_reason) && <Alert tone="danger">Some seats are paused ({seats.find((s) => s.paused_reason)?.paused_reason?.replace("_", " ")}).</Alert>}

      <div>
        <h1 className="text-2xl font-bold">Kia ora, {partner.contact_name}</h1>
        <p className="text-ink-2">{partner.business_name}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Open offers" value={open.length} />
        <Stat label="Accepted this month" value={acceptedThisMonth.length} />
        <Stat label="Accept rate (90d)" value={partner.accept_rate === null ? "—" : `${Math.round(Number(partner.accept_rate) * 100)}%`} hint="Aim for 50%+" />
        <Stat label="Avg response" value={partner.avg_response_mins === null ? "—" : `${Math.round(Number(partner.avg_response_mins))} min`} hint="Aim for under 60 min" />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Open offers</h2>
        {open.length === 0 ? (
          <Card><p className="text-ink-2">No open offers right now. New leads arrive by SMS and email.</p></Card>
        ) : (
          <ul className="space-y-3">
            {open.map((o) => (
              <li key={o.offer_id}>
                <Card className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{serviceList(o.services)} · {o.suburb_name}</p>
                    <p className="text-sm text-muted">
                      {o.est_low_cents && o.est_high_cents ? formatRange(o.est_low_cents / 100, o.est_high_cents / 100) : ""} · closes{" "}
                      {new Date(o.expires_at).toLocaleTimeString("en-NZ", { timeZone: "Pacific/Auckland", hour: "numeric", minute: "2-digit" })}
                      {o.kind === "overflow" && <Badge tone="warn" className="ml-2">Overflow</Badge>}
                    </p>
                  </div>
                  <ButtonLink href={`/offer/${o.token}`}>View &amp; accept</ButtonLink>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p>
        <Link href="/partner/leads" className="text-brand underline">See all leads →</Link>
      </p>
    </div>
  );
}
