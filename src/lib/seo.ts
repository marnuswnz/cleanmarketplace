import { BRAND } from "@/lib/brand";
import type { AreaDef, ServiceDef } from "@/lib/catalog";
import { AREAS } from "@/lib/catalog";

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${siteUrl()}/#business`,
    name: BRAND.name,
    url: siteUrl(),
    email: BRAND.supportEmail,
    description: "Quote matching service connecting Christchurch customers with vetted, insured local cleaning businesses.",
    address: { "@type": "PostalAddress", addressLocality: "Christchurch", addressRegion: "Canterbury", addressCountry: "NZ" },
    areaServed: AREAS.map((a) => ({ "@type": "Place", name: `${a.name}, Christchurch` })),
    priceRange: "$$",
  };
}

export function serviceLd(s: ServiceDef, fromPrice: number | null) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${s.name} in Christchurch`,
    serviceType: s.name,
    description: s.intro,
    url: `${siteUrl()}/${s.slug}`,
    provider: { "@id": `${siteUrl()}/#business` },
    areaServed: { "@type": "City", name: "Christchurch", address: { "@type": "PostalAddress", addressCountry: "NZ" } },
    ...(fromPrice !== null
      ? {
          offers: {
            "@type": "Offer",
            priceCurrency: "NZD",
            priceSpecification: { "@type": "PriceSpecification", minPrice: fromPrice, priceCurrency: "NZD", valueAddedTaxIncluded: true },
            description: "Indicative estimate; final price confirmed by the business.",
          },
        }
      : {}),
  };
}

export function faqLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

export function areaLd(a: AreaDef) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `Cleaning services in ${a.name} Christchurch`,
    provider: { "@id": `${siteUrl()}/#business` },
    areaServed: a.suburbs.map((s) => ({ "@type": "Place", name: `${s}, Christchurch` })),
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${siteUrl()}${it.path}` })),
  };
}
