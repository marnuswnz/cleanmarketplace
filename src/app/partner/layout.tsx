import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/site-chrome";
import { Container } from "@/components/ui";
import { requirePartner } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Partner dashboard", robots: { index: false } };

const NAV = [
  ["/partner", "Overview"],
  ["/partner/leads", "Leads"],
  ["/partner/seats", "Seats & billing"],
  ["/partner/profile", "Profile"],
] as const;

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const { partner } = await requirePartner();
  return (
    <>
      <header className="border-b border-line bg-surface">
        <Container className="flex h-14 items-center justify-between gap-4">
          <Logo />
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-ink-2 sm:inline">{partner.business_name}</span>
            <form method="post" action="/auth/signout">
              <button className="text-brand underline">Sign out</button>
            </form>
          </div>
        </Container>
        <Container>
          <nav aria-label="Partner" className="-mb-px flex gap-1 overflow-x-auto">
            {NAV.map(([href, label]) => (
              <Link key={href} href={href} className="whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-ink-2 hover:border-brand hover:text-ink">
                {label}
              </Link>
            ))}
          </nav>
        </Container>
      </header>
      <main id="main">
        <Container className="py-8">{children}</Container>
      </main>
    </>
  );
}
