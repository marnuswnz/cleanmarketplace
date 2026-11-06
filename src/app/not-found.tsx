import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { ButtonLink, Container } from "@/components/ui";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <Container className="max-w-xl py-20 text-center">
          <h1 className="text-3xl font-bold">Page not found</h1>
          <p className="mt-2 text-ink-2">The page you&apos;re after doesn&apos;t exist or has moved.</p>
          <ButtonLink href="/quote" className="mt-6">Get a cleaning estimate</ButtonLink>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
