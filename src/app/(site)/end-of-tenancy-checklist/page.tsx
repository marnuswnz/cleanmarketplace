import type { Metadata } from "next";
import { QuoteCta } from "@/components/marketing/blocks";
import { Container, JsonLd } from "@/components/ui";
import { breadcrumbLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "End of tenancy cleaning checklist (Christchurch)",
  description: "Room-by-room move-out cleaning checklist for Christchurch renters. Print it, tick it off, and get your bond back.",
  alternates: { canonical: "/end-of-tenancy-checklist" },
};

const SECTIONS: [string, string[]][] = [
  ["Kitchen", ["Oven, racks, trays and door glass degreased", "Rangehood filters cleaned", "Hob and splashback wiped", "Cupboards and drawers inside and out", "Fridge cleaned and defrosted (if supplied)", "Sink and taps descaled", "Benchtops and walls spot-cleaned"]],
  ["Bathrooms & laundry", ["Shower glass and tiles descaled", "Grout and silicone mould-treated", "Toilet inside, outside and behind", "Vanity, mirror and cabinets", "Extractor fan cover dusted", "Laundry tub and dryer lint filter"]],
  ["Bedrooms & living", ["Wardrobes inside, shelves and rails", "Skirting boards, door frames and switches", "Light fittings dusted", "Marks removed from walls", "Heat pump filters cleaned"]],
  ["Windows & floors", ["Interior windows, sills and tracks", "Curtains/blinds dusted or washed", "Carpets professionally cleaned (check your tenancy agreement)", "Hard floors vacuumed and mopped"]],
  ["Outside", ["Rubbish and recycling removed", "Lawns mowed and edges trimmed if required", "Garage and sheds emptied and swept", "Cobwebs removed from entrances"]],
];

export default function ChecklistPage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "End of tenancy checklist", path: "/end-of-tenancy-checklist" }])} />
      <Container className="max-w-3xl py-12">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">End of tenancy cleaning checklist</h1>
        <p className="mt-4 text-lg text-ink-2">
          Use this room-by-room list before your final inspection. It covers what most Christchurch property managers check. Always compare against your
          ingoing inspection report and tenancy agreement.
        </p>
        <div className="mt-8 space-y-8">
          {SECTIONS.map(([title, items]) => (
            <section key={title}>
              <h2 className="text-xl font-bold">{title}</h2>
              <ul className="mt-3 space-y-2">
                {items.map((i) => (
                  <li key={i}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-3">
                      <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[var(--brand)]" />
                      <span>{i}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <p className="mt-8 text-sm text-muted">
          Tip: under the Residential Tenancies Act you must leave the property reasonably clean and tidy. Carpet-cleaning requirements depend on your
          agreement — check before you book.
        </p>
      </Container>
      <QuoteCta service="end_of_tenancy" title="Rather hand it to a pro?" />
    </>
  );
}
