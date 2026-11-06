import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { AREAS, SERVICES } from "@/lib/catalog";
import { ButtonLink, Container } from "./ui";

export function Logo() {
  return (
    <Link href="/" className="flex min-h-11 items-center gap-2 font-bold text-ink" aria-label={`${BRAND.name} home`}>
      <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-sm text-brand-ink">
        ✦
      </span>
      <span>{BRAND.name}</span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-3">
          <Link href="/end-of-tenancy-cleaning-christchurch" className="hidden min-h-11 items-center rounded-lg px-3 text-sm font-medium text-ink-2 hover:text-ink md:flex">
            End of tenancy
          </Link>
          <Link href="/carpet-cleaning-christchurch" className="hidden min-h-11 items-center rounded-lg px-3 text-sm font-medium text-ink-2 hover:text-ink md:flex">
            Carpets
          </Link>
          <Link href="/for-business" className="hidden min-h-11 items-center rounded-lg px-3 text-sm font-medium text-ink-2 hover:text-ink sm:flex">
            For businesses
          </Link>
          <ButtonLink href="/quote" size="sm">
            Get a quote
          </ButtonLink>
        </nav>
      </Container>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-surface">
      <Container className="grid gap-8 py-12 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="text-muted">
            Quotes from vetted, insured local cleaning businesses in {BRAND.city}. Your request goes to no more than 2 businesses per
            service.
          </p>
        </div>
        <div>
          <h2 className="mb-3 font-semibold">Services</h2>
          <ul className="space-y-1 text-ink-2">
            {SERVICES.map((s) => (
              <li key={s.code}>
                <Link href={`/${s.slug}`} className="inline-block py-1 hover:text-brand">
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 font-semibold">Areas</h2>
          <ul className="space-y-1 text-ink-2">
            {AREAS.map((a) => (
              <li key={a.code}>
                <Link href={`/areas/${a.slug}`} className="inline-block py-1 hover:text-brand">
                  {a.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 font-semibold">{BRAND.name}</h2>
          <ul className="space-y-1 text-ink-2">
            <li><Link href="/end-of-tenancy-checklist" className="inline-block py-1 hover:text-brand">End of tenancy checklist</Link></li>
            <li><Link href="/for-business" className="inline-block py-1 hover:text-brand">For cleaning businesses</Link></li>
            <li><Link href="/login" className="inline-block py-1 hover:text-brand">Partner sign in</Link></li>
            <li><Link href="/privacy" className="inline-block py-1 hover:text-brand">Privacy</Link></li>
            <li><Link href="/terms" className="inline-block py-1 hover:text-brand">Terms</Link></li>
            <li><Link href="/partner-terms" className="inline-block py-1 hover:text-brand">Partner terms</Link></li>
          </ul>
        </div>
      </Container>
      <Container className="border-t border-line py-6 text-xs text-muted">
        © {new Date().getFullYear()} {BRAND.legalEntity}. Prices shown are estimates. Partner businesses are independent: they quote,
        perform and are responsible for the work.
      </Container>
    </footer>
  );
}
