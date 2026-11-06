import type { Metadata } from "next";
import { Faq } from "@/components/marketing/blocks";
import { ButtonLink, Card, Container, SectionHeading } from "@/components/ui";
import { AREAS, GROUPS, SEAT_PRICE_CENTS } from "@/lib/catalog";
import { formatNzd } from "@/lib/pricing/estimate";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Get cleaning leads in Christchurch — for businesses",
  description: "Exclusive-area cleaning leads in Christchurch. Max 2 businesses per area and service, flat monthly seat fee, no per-lead bidding.",
  alternates: { canonical: "/for-business" },
};

const FAQS = [
  { q: "How many businesses get each lead?", a: "At most 2 per service group. There are only 2 seats per area and service group, so you're never one of ten." },
  { q: "Do I pay per lead?", a: "No — seat leads are included in your monthly seat fee. If we offer you an overflow lead from a neighbouring area, it's a flat per-lead fee you only pay if you accept." },
  { q: "How fast do I need to respond?", a: "Offers are open for 30 minutes. If you don't accept in time, the lead moves to the next business. No offers are sent between 8pm and 7am." },
  { q: "What do you check?", a: "NZBN, current public liability insurance, and online reviews. We monitor response times and customer feedback to keep quality high." },
  { q: "Can I cancel?", a: "Yes, with 30 days' notice. See the partner terms for details." },
];

export default function ForBusiness() {
  return (
    <>
      <section className="border-b border-line bg-surface">
        <Container className="py-14 sm:py-20">
          <p className="mb-3 inline-flex rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-2">For cleaning businesses</p>
          <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">Ready-to-book jobs in your area. Shared with one other business, max.</h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-2">
            Customers come to {BRAND.name} with a price expectation already set. You get an SMS, tap accept, and their number is yours. Founding partners get
            60 days free.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href="/for-business/apply" size="lg">Apply for a seat</ButtonLink>
            <ButtonLink href="/partner-terms" size="lg" variant="secondary">Partner terms</ButtonLink>
          </div>
        </Container>
      </section>
      <section className="py-14">
        <Container className="grid gap-4 md:grid-cols-3">
          {[
            ["2 seats per area", `Christchurch is split into ${AREAS.length} areas × ${GROUPS.length} service groups. Each has only 2 seats.`],
            ["SMS in seconds", "New leads arrive by SMS and email with suburb, job details and the estimate the customer saw."],
            ["Flat monthly fee", `From ${formatNzd(SEAT_PRICE_CENTS.standard / 100)}/month per seat (larger areas ${formatNzd(SEAT_PRICE_CENTS.large / 100)}). No bidding, no credits.`],
          ].map(([t, d]) => (
            <Card key={t}>
              <h2 className="font-semibold">{t}</h2>
              <p className="mt-1 text-sm text-ink-2">{d}</p>
            </Card>
          ))}
        </Container>
      </section>
      <section className="py-6">
        <Container className="space-y-6">
          <SectionHeading title="Areas and service groups" intro="Apply for the cells you can reliably serve. Seat prices are placeholders pending launch." />
          <div className="overflow-x-auto rounded-card border border-line bg-surface">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-surface-2">
                <tr>
                  <th className="p-3">Area</th>
                  {GROUPS.map((g) => (
                    <th key={g.code} className="p-3">{g.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {AREAS.map((a) => (
                  <tr key={a.code} className="border-t border-line">
                    <th scope="row" className="p-3 font-medium">
                      {a.name}
                      <span className="block text-xs font-normal text-muted">{a.suburbs.slice(0, 4).join(", ")}…</span>
                    </th>
                    {GROUPS.map((g) => (
                      <td key={g.code} className="p-3 text-ink-2">2 seats · {formatNzd(SEAT_PRICE_CENTS[a.priceTier] / 100)}/mo</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </section>
      <section className="py-14">
        <Container className="max-w-3xl space-y-6">
          <SectionHeading title="Questions from businesses" />
          <Faq items={FAQS} />
          <ButtonLink href="/for-business/apply" size="lg">Apply for a seat</ButtonLink>
        </Container>
      </section>
    </>
  );
}
