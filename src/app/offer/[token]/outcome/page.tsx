import type { Metadata } from "next";
import { Alert, Button, Card, Container } from "@/components/ui";
import { adminDb } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Job outcome", robots: { index: false, follow: false } };

const LABEL = { booked: "Yes, it booked", not_booked: "No, it didn't book", no_contact: "Couldn't reach the customer" } as const;

/** Landing page for the T+3 "Did this job book?" prompt. A POST (not the GET) records it, so link scanners can't. */
export default async function OutcomePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ o?: string; saved?: string }> }) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const { data } = await adminDb().from("lead_offers").select("status, outcome, leads!inner(ref_code)").eq("token", token).maybeSingle();
  const ref = (data?.leads as unknown as { ref_code: string } | undefined)?.ref_code;
  if (!data || data.status !== "accepted") {
    return (
      <Container className="max-w-md py-12">
        <Card><p>This link isn&apos;t valid.</p></Card>
      </Container>
    );
  }
  const preselect = sp.o && sp.o in LABEL ? (sp.o as keyof typeof LABEL) : null;
  return (
    <Container className="max-w-md py-12">
      <Card>
        <h1 className="text-xl font-bold">Did lead {ref} book?</h1>
        {sp.saved === "1" || data.outcome ? (
          <Alert tone="ok" className="mt-4">Thanks — recorded as &quot;{LABEL[(data.outcome ?? preselect ?? "booked") as keyof typeof LABEL]}&quot;.</Alert>
        ) : null}
        <div className="mt-6 grid gap-3">
          {(Object.keys(LABEL) as (keyof typeof LABEL)[]).map((k) => (
            <form key={k} method="post" action={`/api/offers/${token}/outcome`}>
              <input type="hidden" name="outcome" value={k} />
              <Button type="submit" size="lg" variant={k === preselect ? "primary" : "secondary"} className="w-full">
                {LABEL[k]}
              </Button>
            </form>
          ))}
        </div>
      </Card>
    </Container>
  );
}
