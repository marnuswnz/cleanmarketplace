import Link from "next/link";
import { AREAS, SERVICES, type ServiceDef } from "@/lib/catalog";
import { formatNzd, fromPrice } from "@/lib/pricing/estimate";
import type { PricingConfig } from "@/lib/pricing/schema";
import { BRAND } from "@/lib/brand";
import { ButtonLink, Card, Container, SectionHeading } from "@/components/ui";

export function ServiceGrid({ pricing, services = SERVICES }: { pricing: PricingConfig; services?: ServiceDef[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((s) => {
        const from = fromPrice(s.code, pricing);
        return (
          <li key={s.code}>
            <Link href={`/${s.slug}`} className="group block h-full rounded-card border border-line bg-surface p-5 shadow-card transition hover:border-brand">
              <h3 className="font-semibold text-ink group-hover:text-brand">{s.name}</h3>
              <p className="mt-1 text-sm text-ink-2">{s.tagline}</p>
              {from !== null && (
                <p className="mt-3 text-sm">
                  <span className="text-muted">Estimates from </span>
                  <span className="font-semibold text-ink">{formatNzd(from)}</span>
                </p>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function HowItWorks() {
  const steps = [
    { t: "Get an instant estimate", d: "Tell us about the job and see an indicative price range straight away — no sign-up." },
    { t: "We match up to 2 local pros", d: "Your request goes to at most 2 vetted, insured businesses covering your suburb. Never a bidding frenzy." },
    { t: "They contact you to quote", d: "Usually within the hour during business hours. You compare, choose, and deal with them directly." },
  ];
  return (
    <ol className="grid gap-4 md:grid-cols-3">
      {steps.map((s, i) => (
        <li key={s.t}>
          <Card className="h-full">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft font-bold text-brand-2">{i + 1}</span>
            <h3 className="mt-3 font-semibold">{s.t}</h3>
            <p className="mt-1 text-sm text-ink-2">{s.d}</p>
          </Card>
        </li>
      ))}
    </ol>
  );
}

export function TrustPoints() {
  const points = [
    ["Max 2 businesses", "Your details go to no more than 2 businesses per service. No spam."],
    ["Vetted & insured", "We check NZBN, public liability insurance and reviews before any business joins."],
    ["Local to your suburb", "Businesses hold a seat in your area of Christchurch, so they actually turn up."],
    ["Free for you", "No fees for customers. You pay the business directly for the work."],
  ];
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {points.map(([t, d]) => (
        <li key={t} className="rounded-card bg-surface-2 p-5">
          <h3 className="font-semibold">{t}</h3>
          <p className="mt-1 text-sm text-ink-2">{d}</p>
        </li>
      ))}
    </ul>
  );
}

export function AreaLinks() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {AREAS.map((a) => (
        <li key={a.code}>
          <Link href={`/areas/${a.slug}`} className="block rounded-xl border border-line bg-surface p-4 hover:border-brand">
            <span className="font-semibold">{a.name}</span>
            <span className="mt-1 block text-sm text-muted">{a.suburbs.slice(0, 5).join(", ")}…</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="divide-y divide-line rounded-card border border-line bg-surface">
      {items.map((f) => (
        <details key={f.q} className="group p-5">
          <summary className="cursor-pointer list-none font-semibold marker:hidden">
            <span className="flex items-center justify-between gap-4">
              {f.q}
              <span aria-hidden className="text-brand transition group-open:rotate-45">+</span>
            </span>
          </summary>
          <p className="mt-2 text-ink-2">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export function QuoteCta({ service, title }: { service?: string; title?: string }) {
  return (
    <section className="py-12">
      <Container>
        <div className="flex flex-col items-start gap-4 rounded-card bg-brand p-8 text-brand-ink sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold">{title ?? "See your price in under a minute"}</h2>
            <p className="mt-1 opacity-90">Free, no obligation. Up to 2 local businesses will contact you.</p>
          </div>
          <ButtonLink href={service ? `/quote?service=${service}` : "/quote"} variant="secondary" size="lg">
            Get my estimate
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}

export const GENERAL_FAQS = [
  {
    q: `How does ${BRAND.name} work?`,
    a: "You describe the job and get an instant estimate. We send your request to up to 2 vetted local businesses that cover your suburb, and they contact you to confirm a price.",
  },
  {
    q: "Is the price final?",
    a: "No — it's an estimate based on typical Christchurch prices. The business confirms the final price after talking to you, and may need to see the property.",
  },
  {
    q: "Who does the work?",
    a: `Independent local businesses. They quote, perform and are responsible for the work. ${BRAND.name} checks their business details and insurance before they join.`,
  },
  {
    q: "How many businesses will contact me?",
    a: "At most 2 for each type of service you request — for example 2 for home cleaning and 2 for carpets if you ask for both.",
  },
];

export { SectionHeading };
