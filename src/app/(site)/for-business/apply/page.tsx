import type { Metadata } from "next";
import { ApplyForm } from "@/components/partner/apply-form";
import { Container } from "@/components/ui";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Apply to become a partner",
  description: "Apply for a lead seat as a Christchurch cleaning business.",
  alternates: { canonical: "/for-business/apply" },
};

export default function ApplyPage() {
  return (
    <Container className="max-w-2xl py-12">
      <h1 className="text-3xl font-extrabold tracking-tight">Apply for a seat</h1>
      <p className="mt-2 text-ink-2">Takes about 3 minutes. We review every application within 2 business days.</p>
      <ApplyForm turnstileSiteKey={env.turnstileSiteKey()} />
    </Container>
  );
}
