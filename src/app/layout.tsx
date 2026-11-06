import type { Metadata, Viewport } from "next";
import { Analytics } from "@/components/analytics";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: {
    default: `Cleaning quotes in Christchurch | ${BRAND.name}`,
    template: `%s | ${BRAND.name}`,
  },
  description:
    "Get an instant price estimate and quotes from vetted, insured Christchurch cleaning businesses — end of tenancy, carpets, ovens, windows and house washing.",
  openGraph: { type: "website", locale: "en_NZ", siteName: BRAND.name },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0f6b4f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NZ">
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
          Skip to content
        </a>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
