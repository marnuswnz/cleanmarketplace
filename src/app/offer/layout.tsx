import { Logo } from "@/components/site-chrome";
import { Container } from "@/components/ui";

export default function OfferLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-line bg-surface">
        <Container className="flex h-14 items-center">
          <Logo />
        </Container>
      </header>
      <main id="main">{children}</main>
    </>
  );
}
