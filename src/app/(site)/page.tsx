import { AreaLinks, Faq, GENERAL_FAQS, HowItWorks, QuoteCta, ServiceGrid, TrustPoints } from "@/components/marketing/blocks";
import { ButtonLink, Container, EstimateNote, JsonLd, SectionHeading } from "@/components/ui";
import { SERVICES } from "@/lib/catalog";
import { loadPricing } from "@/lib/pricing/load";
import { faqLd, organizationLd } from "@/lib/seo";

export const revalidate = 3600;

export default async function Home() {
  const pricing = await loadPricing();
  return (
    <>
      <JsonLd data={organizationLd()} />
      <JsonLd data={faqLd(GENERAL_FAQS)} />
      <section className="border-b border-line bg-surface">
        <Container className="grid gap-10 py-14 sm:py-20 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-2">Christchurch · Ōtautahi</p>
            <h1 className="text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
              Cleaning quotes from local pros, with a price up front.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-ink-2">
              End of tenancy, carpets, ovens, windows and house washing. See an instant estimate, then hear from up to 2 vetted,
              insured Christchurch businesses — never more.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink href="/quote" size="lg">
                Get my instant estimate
              </ButtonLink>
              <ButtonLink href="/end-of-tenancy-cleaning-christchurch" size="lg" variant="secondary">
                Moving out?
              </ButtonLink>
            </div>
            <EstimateNote className="mt-4 max-w-md" />
          </div>
          <div className="rounded-card border border-line bg-bg p-5">
            <p className="text-sm font-semibold text-ink-2">What do you need cleaned?</p>
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {SERVICES.map((s) => (
                <li key={s.code}>
                  <a
                    href={`/quote?service=${s.code}`}
                    className="flex min-h-12 items-center rounded-xl border border-line bg-surface px-3 text-sm font-medium hover:border-brand hover:text-brand"
                  >
                    {s.short}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      <section className="py-14">
        <Container className="space-y-8">
          <SectionHeading eyebrow="How it works" title="Three steps, no runaround" />
          <HowItWorks />
        </Container>
      </section>

      <section className="py-6">
        <Container className="space-y-8">
          <SectionHeading eyebrow="Services" title="What we can quote" intro="Estimates are based on typical Christchurch prices and update as you add details." />
          <ServiceGrid pricing={pricing} />
        </Container>
      </section>

      <section className="py-14">
        <Container className="space-y-8">
          <SectionHeading eyebrow="Why us" title="Built to respect your time and inbox" />
          <TrustPoints />
        </Container>
      </section>

      <section className="py-6">
        <Container className="space-y-8">
          <SectionHeading eyebrow="Coverage" title="Across Christchurch and surrounds" />
          <AreaLinks />
        </Container>
      </section>

      <section className="py-14">
        <Container className="max-w-3xl space-y-6">
          <SectionHeading title="Questions" />
          <Faq items={GENERAL_FAQS} />
        </Container>
      </section>
      <QuoteCta />
    </>
  );
}
