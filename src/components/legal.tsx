import { Container } from "@/components/ui";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <Container className="max-w-3xl py-12">
      <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted">Last updated {updated}. Draft for legal review before launch.</p>
      <div className="prose-legal mt-6">{children}</div>
    </Container>
  );
}
