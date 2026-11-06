import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Faq, GENERAL_FAQS, HowItWorks, QuoteCta, ServiceGrid } from "@/components/marketing/blocks";
import { ButtonLink, Card, Container, EstimateNote, JsonLd, SectionHeading } from "@/components/ui";
import { AREAS, SERVICES, SERVICE_BY_SLUG } from "@/lib/catalog";
import { DEFAULT_DETAILS, estimate, formatNzd, formatRange, fromPrice } from "@/lib/pricing/estimate";
import { loadPricing } from "@/lib/pricing/load";
import { breadcrumbLd, faqLd, serviceLd } from "@/lib/seo";

export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return SERVICES.map((s) => ({ service: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ service: string }> }): Promise<Metadata> {
  const s = SERVICE_BY_SLUG[(await params).service];
  if (!s) return {};
  return {
    title: `${s.name} Christchurch — instant estimate`,
    description: `${s.tagline} Get an instant price estimate and quotes from up to 2 vetted, insured Christchurch businesses.`,
    alternates: { canonical: `/${s.slug}` },
    openGraph: { title: `${s.name} in Christchurch`, description: s.tagline, url: `/${s.slug}` },
  };
}

export default async function ServicePage({ params }: { params: Promise<{ service: string }> }) {
  const s = SERVICE_BY_SLUG[(await params).service];
  if (!s) notFound();
  const pricing = await loadPricing();
  const from = fromPrice(s.code, pricing);
  const typical = estimate([s.code], { [s.code]: DEFAULT_DETAILS[s.code] }, pricing);
  const faqs = [...s.faqs, ...GENERAL_FAQS.slice(1)];
  const related = SERVICES.filter((x) => x.code !== s.code && (x.group === s.group || s.code === "end_of_tenancy")).slice(0, 3);

  return (
    <>
      <JsonLd data={serviceLd(s, from)} />
      <JsonLd data={faqLd(faqs)} />
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: s.name, path: `/${s.slug}` }])} />
      <section className="border-b border-line bg-surface">
        <Container className="grid gap-10 py-12 sm:py-16 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
              <Link href="/" className="hover:text-brand">Home</Link> / <span>{s.name}</span>
            </nav>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{s.name} in Christchurch</h1>
            <p className="mt-4 text-lg text-ink-2">{s.intro}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href={`/quote?service=${s.code}`} size="lg">
                Get my estimate
              </ButtonLink>
              {s.code === "end_of_tenancy" && (
                <ButtonLink href="/end-of-tenancy-checklist" variant="secondary" size="lg">
                  Free move-out checklist
                </ButtonLink>
              )}
            </div>
          </div>
          <Card className="self-start">
            <p className="text-sm font-semibold text-muted">Typical estimate</p>
            <p className="mt-1 text-3xl font-bold">{formatRange(typical.low, typical.high)}</p>
            <ul className="mt-3 space-y-1 text-sm text-ink-2">
              {typical.lineItems.map((li) => (
                <li key={li.label}>{li.label}</li>
              ))}
            </ul>
            {from !== null && <p className="mt-3 text-sm">Estimates from <strong>{formatNzd(from)}</strong></p>}
            <EstimateNote className="mt-4" />
          </Card>
        </Container>
      </section>

      <section className="py-12">
        <Container className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading title="What's usually included" />
            <ul className="mt-5 space-y-2">
              {s.includes.map((i) => (
                <li key={i} className="flex gap-3 text-ink-2">
                  <span aria-hidden className="text-brand">✓</span>
                  {i}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted">Exact inclusions vary by business — confirm when they contact you.</p>
          </div>
          <div>
            <SectionHeading title="Where we cover" />
            <ul className="mt-5 flex flex-wrap gap-2">
              {AREAS.map((a) => (
                <li key={a.code}>
                  <Link href={`/areas/${a.slug}`} className="inline-block rounded-full border border-line bg-surface px-3 py-1.5 text-sm hover:border-brand">
                    {a.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      <section className="py-6">
        <Container className="space-y-8">
          <SectionHeading title="How it works" />
          <HowItWorks />
        </Container>
      </section>

      <section className="py-12">
        <Container className="max-w-3xl space-y-6">
          <SectionHeading title={`${s.name}: common questions`} />
          <Faq items={faqs} />
        </Container>
      </section>

      {related.length > 0 && (
        <section className="py-6">
          <Container className="space-y-6">
            <SectionHeading title="Often booked together" />
            <ServiceGrid pricing={pricing} services={related} />
          </Container>
        </section>
      )}
      <QuoteCta service={s.code} />
    </>
  );
}
