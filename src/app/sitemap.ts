import type { MetadataRoute } from "next";
import { AREAS, SERVICES } from "@/lib/catalog";
import { siteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/quote`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    ...SERVICES.map((s) => ({ url: `${base}/${s.slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.9 })),
    ...AREAS.map((a) => ({ url: `${base}/areas/${a.slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.7 })),
    { url: `${base}/end-of-tenancy-checklist`, lastModified: now, changeFrequency: "yearly", priority: 0.6 },
    { url: `${base}/for-business`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/for-business/apply`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/partner-terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}
