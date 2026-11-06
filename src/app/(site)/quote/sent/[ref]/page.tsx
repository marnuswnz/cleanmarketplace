import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, ButtonLink, Card, Container, EstimateNote } from "@/components/ui";
import { publicLeadSummary } from "@/lib/leads";
import { serviceList } from "@/lib/messaging/templates";
import { formatRange } from "@/lib/pricing/estimate";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Request sent", robots: { index: false } };

export default async function SentPage({ params }: { params: Promise<{ ref: string }> }) {
  const lead = await publicLeadSummary((await params).ref);
  if (!lead) notFound();
  const offered = lead.status === "offered" || lead.status === "routing" || lead.status === "new";
  return (
    <Container className="max-w-2xl py-12">
      <Card>
        <Badge tone="ok">Request received</Badge>
        <h1 className="mt-3 text-3xl font-bold">Thanks — we&apos;re on it.</h1>
        <p className="mt-2 text-ink-2">
          Reference <strong>{lead.ref_code}</strong>. We&apos;re sending your {serviceList(lead.services).toLowerCase()} request in {lead.suburb} to up to 2 local
          businesses per service. We&apos;ll text you as soon as one picks it up.
        </p>
        {lead.est_low_cents && lead.est_high_cents ? (
          <p className="mt-4 text-lg">
            Your estimate: <strong>{formatRange(lead.est_low_cents / 100, lead.est_high_cents / 100)}</strong>
          </p>
        ) : null}
        <EstimateNote className="mt-2" />

        {lead.businesses.length > 0 && (
          <div className="mt-6">
            <h2 className="font-semibold">Businesses contacting you</h2>
            <ul className="mt-2 space-y-2">
              {lead.businesses.map((b) => (
                <li key={b.business_name} className="rounded-xl bg-surface-2 px-4 py-3">
                  <span className="font-medium">{b.business_name}</span>
                  {b.gbp_url && (
                    <a href={b.gbp_url} className="ml-2 text-sm text-brand underline" rel="noopener nofollow" target="_blank">
                      Reviews
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {offered && lead.businesses.length === 0 && (
          <p className="mt-6 rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-2">
            Requests made between 8pm and 7am are sent to businesses at 7am.
          </p>
        )}
        <h2 className="mt-8 font-semibold">What happens next</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink-2">
          <li>A business accepts your request — we text you their name.</li>
          <li>They call or text you to confirm the job and price.</li>
          <li>You choose who to book. You pay them directly.</li>
        </ol>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/end-of-tenancy-checklist" variant="secondary">
            Moving out? Get the checklist
          </ButtonLink>
          <ButtonLink href="/" variant="ghost">
            Back to home
          </ButtonLink>
        </div>
      </Card>
    </Container>
  );
}
