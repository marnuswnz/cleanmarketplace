import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/site-chrome";
import { Container } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false } };

const NAV = [
  ["/admin", "Overview"],
  ["/admin/leads", "Leads"],
  ["/admin/partners", "Partners"],
  ["/admin/seats", "Seats"],
  ["/admin/pricing", "Pricing"],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin();
  return (
    <>
      <header className="border-b border-line bg-surface">
        <Container className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="rounded bg-ink px-2 py-0.5 text-xs font-bold text-white">ADMIN</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted sm:inline">{user.email}</span>
            <form method="post" action="/auth/signout">
              <button className="text-brand underline">Sign out</button>
            </form>
          </div>
        </Container>
        <Container>
          <nav aria-label="Admin" className="-mb-px flex gap-1 overflow-x-auto">
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
