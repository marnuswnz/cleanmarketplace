import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert, Button, Card, Container, Field, Textarea } from "@/components/ui";
import { publicLeadSummary } from "@/lib/leads";
import { adminDb } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "How did it go?", robots: { index: false } };

function YesNo({ name, legend, required }: { name: string; legend: string; required?: boolean }) {
  return (
    <fieldset>
      <legend className="mb-2 font-semibold">{legend}</legend>
      <div className="flex gap-2">
        {[
          ["yes", "Yes"],
          ["no", "No"],
        ].map(([v, l]) => (
          <label key={v} className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-surface has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
            <input type="radio" name={name} value={v} required={required} className="accent-[var(--brand)]" />
            {l}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default async function FeedbackPage({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<{ done?: string; error?: string }> }) {
  const [{ ref }, sp] = await Promise.all([params, searchParams]);
  const lead = await publicLeadSummary(ref);
  if (!lead || !lead.first_accepted_at) notFound();
  const { count } = await adminDb().from("feedback").select("id", { count: "exact", head: true }).eq("lead_id", lead.id);
  const done = sp.done === "1" || (count ?? 0) > 0;

  return (
    <Container className="max-w-xl py-12">
      <Card>
        <h1 className="text-2xl font-bold">How did it go?</h1>
        <p className="mt-1 text-ink-2">
          Request {lead.ref_code} · {lead.businesses.map((b) => b.business_name).join(" & ")}
        </p>
        {done ? (
          <Alert tone="ok" className="mt-6">Thanks for your feedback — it helps keep our partner businesses great.</Alert>
        ) : (
          <form method="post" action={`/api/feedback/${lead.ref_code}`} className="mt-6 space-y-6">
            {sp.error && <Alert tone="danger">Something went wrong — please check your answers and try again.</Alert>}
            <YesNo name="contacted" legend="Did a business contact you?" required />
            <YesNo name="booked" legend="Did you book the job?" />
            <fieldset>
              <legend className="mb-2 font-semibold">How would you rate the business?</legend>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} className="flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
                    <input type="radio" name="rating" value={n} className="sr-only" />
                    <span aria-label={`${n} out of 5`}>{n}★</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="Anything else? (optional)" htmlFor="comment">
              <Textarea id="comment" name="comment" maxLength={1000} />
            </Field>
            <Button type="submit" size="lg">Send feedback</Button>
          </form>
        )}
      </Card>
    </Container>
  );
}
