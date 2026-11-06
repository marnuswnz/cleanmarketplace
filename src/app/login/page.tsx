import type { Metadata } from "next";
import { LoginForm } from "@/components/partner/login-form";
import { SiteHeader } from "@/components/site-chrome";
import { Alert, Card, Container } from "@/components/ui";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const ERRORS: Record<string, string> = {
  link: "That sign-in link has expired or was already used. Request a new one.",
  no_partner: "This email isn't linked to an approved partner account.",
  not_admin: "You don't have admin access.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <>
      <SiteHeader />
      <main id="main">
        <Container className="max-w-md py-12">
          <Card>
            <h1 className="text-2xl font-bold">Partner sign in</h1>
            <p className="mt-1 text-ink-2">We&apos;ll email you a secure sign-in link.</p>
            {error && ERRORS[error] && <Alert tone="danger" className="mt-4">{ERRORS[error]}</Alert>}
            <LoginForm next={next?.startsWith("/") ? next : "/partner"} />
          </Card>
        </Container>
      </main>
    </>
  );
}
