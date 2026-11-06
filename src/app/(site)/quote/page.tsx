import type { Metadata } from "next";
import { QuoteForm } from "@/components/quote/quote-form";
import { Container } from "@/components/ui";
import { env } from "@/lib/env";
import { loadPricing } from "@/lib/pricing/load";

export const metadata: Metadata = {
  title: "Get an instant cleaning estimate",
  description: "Instant price estimate for cleaning in Christchurch. Hear from up to 2 vetted, insured local businesses.",
  alternates: { canonical: "/quote" },
};

export default async function QuotePage({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  const [{ service }, pricing] = await Promise.all([searchParams, loadPricing()]);
  return (
    <Container className="py-8 sm:py-12">
      <QuoteForm pricing={pricing} initialService={service} turnstileSiteKey={env.turnstileSiteKey()} />
    </Container>
  );
}
