import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HowItWorks, QuoteCta, ServiceGrid } from "@/components/marketing/blocks";
import { ButtonLink, Container, JsonLd, SectionHeading } from "@/components/ui";
import { AREAS, AREA_BY_SLUG } from "@/lib/catalog";
import { loadPricing } from "@/lib/pricing/load";
import { areaLd, breadcrumbLd } from "@/lib/seo";

export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return AREAS.map((a) => ({ area: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ area: string }> }): Promise<Metadata> {
  const a = AREA_BY_SLUG[(await params).area];
  if (!a) return {};
  return {
    title: `Cleaners in ${a.name} Christchurch — ${a.suburbs.slice(0, 3).join(", ")}`,
    description: `Instant cleaning estimates and quotes from vetted local businesses in ${a.suburbs.join(", ")}.`,
    alternates: { canonical: `/areas/${a.slug}` },
  };
}

export default async function AreaPage({ params }: { params: Promise<{ area: string }> }) {
  const a = AREA_BY_SLUG[(await params).area];
  if (!a) notFound();
  const pricing = await loadPricing();
  return (
    <>
      <JsonLd data={areaLd(a)} />
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: a.name, path: `/areas/${a.slug}` }])} />
      <section className="border-b border-line bg-surface">
        <Container className="py-12 sm:py-16">
          <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
            <Link href="/" className="hover:text-brand">Home</Link> / <span>Areas</span> / <span>{a.name}</span>
          </nav>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Cleaning services in {a.name} Christchurch</h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-2">
            {a.blurb} Get an instant estimate and hear from up to 2 vetted businesses that cover your suburb.
          </p>
          <ButtonLink href="/quote" size="lg" className="mt-6">
            Get my estimate
          </ButtonLink>
        </Container>
      </section>
      <section className="py-12">
        <Container className="space-y-6">
          <SectionHeading title="Suburbs we cover here" />
          <ul className="flex flex-wrap gap-2">
            {a.suburbs.map((s) => (
              <li key={s} className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm">
                {s}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">Not listed? Start a quote anyway — if we don&apos;t cover you yet, you can join the waitlist.</p>
        </Container>
      </section>
      <section className="py-6">
        <Container className="space-y-6">
          <SectionHeading title={`Services in ${a.name}`} />
          <ServiceGrid pricing={pricing} />
        </Container>
      </section>
      <section className="py-12">
        <Container className="space-y-6">
          <SectionHeading title="How it works" />
          <HowItWorks />
        </Container>
      </section>
      <QuoteCta />
    </>
  );
}
