import type { Metadata } from "next";
import Link from "next/link";
import { LeadDetails } from "@/components/lead-details";
import { Alert, Badge, Button, Card, Container } from "@/components/ui";
import { env } from "@/lib/env";
import { formatRange, formatNzd } from "@/lib/pricing/estimate";
import { adminDb } from "@/lib/supabase/admin";
import { formatNzMobile } from "@/lib/validation";
import { requestTime } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lead offer", robots: { index: false, follow: false } };

const RESULT_MESSAGES: Record<string, { tone: "ok" | "warn" | "danger" | "neutral"; text: string }> = {
  accepted: { tone: "ok", text: "Accepted — the lead is yours. Contact the customer now." },
  already_accepted: { tone: "ok", text: "You've already accepted this lead." },
  declined: { tone: "neutral", text: "Declined. Thanks for letting us know quickly — we've passed it on." },
  already_declined: { tone: "neutral", text: "You've already declined this lead." },
  expired: { tone: "warn", text: "Sorry, this offer has expired and the lead has moved to another business." },
  filled: { tone: "warn", text: "Sorry, 2 businesses have already accepted this lead." },
  cancelled: { tone: "warn", text: "This offer was withdrawn." },
  already_cancelled: { tone: "warn", text: "This offer was withdrawn." },
  already_expired: { tone: "warn", text: "Sorry, this offer has expired and the lead has moved to another business." },
};

type OfferRow = {
  id: string;
  token: string;
  status: "offered" | "accepted" | "declined" | "expired" | "cancelled";
  kind: "seat" | "overflow";
  offered_at: string;
  expires_at: string;
  partners: { business_name: string };
  leads: {
    id: string;
    ref_code: string;
    services: string[];
    details: Record<string, unknown>;
    est_low_cents: number | null;
    est_high_cents: number | null;
    preferred_date: string | null;
    flexible: boolean;
    customer_name: string | null;
    customer_mobile: string | null;
    customer_email: string | null;
    notes: string | null;
    status: string;
    suburbs: { name: string };
    areas: { name: string };
  };
};

function ExpiredPage({ title, body }: { title: string; body: string }) {
  return (
    <Container className="max-w-xl py-12">
      <Card>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-ink-2">{body}</p>
        <Link href="/partner" className="mt-6 inline-block text-brand underline">Go to your dashboard</Link>
      </Card>
    </Container>
  );
}

export default async function OfferPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ r?: string }> }) {
  const [{ token }, { r }] = await Promise.all([params, searchParams]);
  const { data } = await adminDb()
    .from("lead_offers")
    .select(
      "id, token, status, kind, offered_at, expires_at, partners!inner(business_name), leads!inner(id, ref_code, services, details, est_low_cents, est_high_cents, preferred_date, flexible, customer_name, customer_mobile, customer_email, notes, status, suburbs!inner(name), areas!inner(name))",
    )
    .eq("token", token)
    .maybeSingle();
  const o = data as unknown as OfferRow | null;
  if (!o) return <ExpiredPage title="Offer not found" body="This link isn't valid. Check you opened the full link from the SMS or email." />;

  const now = requestTime();
  const lapsed = o.status === "offered" && new Date(o.expires_at).getTime() < now;
  const status = lapsed ? "expired" : o.status;
  const l = o.leads;
  const msg = r ? RESULT_MESSAGES[r] : undefined;
  const minsLeft = Math.max(0, Math.round((new Date(o.expires_at).getTime() - now) / 60000));

  if ((status === "expired" || status === "cancelled") && !msg) {
    return <ExpiredPage title="This offer has closed" body="The 30-minute window has passed and the lead has moved on. Keep an eye on your SMS — the next one could be yours." />;
  }

  return (
    <Container className="max-w-2xl py-8">
      {msg && <Alert tone={msg.tone} className="mb-4">{msg.text}</Alert>}
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={status === "accepted" ? "ok" : status === "offered" ? "brand" : "neutral"}>{status === "offered" ? "New lead" : status}</Badge>
          {o.kind === "overflow" && <Badge tone="warn">Overflow · {formatNzd(env.overflowPriceCents() / 100)} if accepted</Badge>}
          <span className="text-sm text-muted">Ref {l.ref_code}</span>
        </div>
        <h1 className="mt-3 text-2xl font-bold">
          {l.suburbs.name} <span className="font-normal text-muted">· {l.areas.name}</span>
        </h1>
        <p className="mt-1 text-ink-2">For {o.partners.business_name}</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-muted">Customer saw estimate</p>
            <p className="text-xl font-bold">{l.est_low_cents && l.est_high_cents ? formatRange(l.est_low_cents / 100, l.est_high_cents / 100) : "—"}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-muted">Preferred date</p>
            <p className="text-xl font-bold">{l.preferred_date ?? "Flexible"}{l.preferred_date && l.flexible ? " (flexible)" : ""}</p>
          </div>
        </div>
        <div className="mt-6">
          <LeadDetails services={l.services} details={l.details} />
        </div>

        {status === "accepted" ? (
          <div className="mt-6 rounded-xl bg-ok-soft p-4">
            <h2 className="font-semibold text-ok">Customer contact</h2>
            <p className="mt-2 text-lg font-semibold">{l.customer_name}</p>
            {l.customer_mobile && (
              <p>
                <a className="text-brand underline" href={`tel:${l.customer_mobile}`}>{formatNzMobile(l.customer_mobile)}</a>
                {" · "}
                <a className="text-brand underline" href={`sms:${l.customer_mobile}`}>Text</a>
              </p>
            )}
            {l.customer_email && <p><a className="text-brand underline" href={`mailto:${l.customer_email}`}>{l.customer_email}</a></p>}
            {l.notes && <p className="mt-3 text-sm text-ink-2">Notes: {l.notes}</p>}
            <p className="mt-3 text-sm">
              <Link href={`/partner/leads/${l.id}`} className="text-brand underline">Open in dashboard</Link>
            </p>
          </div>
        ) : status === "offered" ? (
          <>
            <p className="mt-6 rounded-xl bg-surface-2 p-3 text-sm text-ink-2">
              Customer contact details are shown after you accept. This lead goes to at most 2 businesses. Offer closes in <strong>{minsLeft} min</strong>.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <form method="post" action={`/api/offers/${o.token}/accept`}>
                <Button type="submit" size="lg" className="w-full">Accept lead</Button>
              </form>
              <form method="post" action={`/api/offers/${o.token}/decline`}>
                <Button type="submit" size="lg" variant="secondary" className="w-full">Decline</Button>
              </form>
            </div>
          </>
        ) : null}
      </Card>
    </Container>
  );
}
