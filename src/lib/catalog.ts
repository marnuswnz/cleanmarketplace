/**
 * Seed catalog for Christchurch.
 *
 * This file is the *seed* for the database (see scripts/generate-seed.ts →
 * supabase/seed.sql) and the source of static marketing content (service and
 * area landing pages). At runtime the database is authoritative for routing:
 * suburb → area resolution, seats and pricing all read from Postgres, and can
 * be edited in admin without a deploy.
 */

export type GroupCode = "HOME" | "CARPET" | "EXTERIOR";

export type ServiceCode =
  | "end_of_tenancy"
  | "deep_clean"
  | "oven_clean"
  | "carpet_clean"
  | "upholstery_clean"
  | "window_clean"
  | "house_wash";

export type AreaCode = "CEN" | "NTH" | "EST" | "STH" | "WST" | "GRT";

export interface GroupDef {
  code: GroupCode;
  name: string;
}

export interface ServiceDef {
  code: ServiceCode;
  name: string;
  /** Short name used in chips and summaries. */
  short: string;
  slug: string;
  group: GroupCode;
  tagline: string;
  intro: string;
  includes: string[];
  faqs: { q: string; a: string }[];
}

export interface AreaDef {
  code: AreaCode;
  name: string;
  slug: string;
  priceTier: "standard" | "large";
  suburbs: string[];
  blurb: string;
}

export const GROUPS: GroupDef[] = [
  { code: "HOME", name: "Home cleaning" },
  { code: "CARPET", name: "Carpet & upholstery" },
  { code: "EXTERIOR", name: "Windows & exterior" },
];

export const SERVICES: ServiceDef[] = [
  {
    code: "end_of_tenancy",
    name: "End of tenancy cleaning",
    short: "End of tenancy",
    slug: "end-of-tenancy-cleaning-christchurch",
    group: "HOME",
    tagline: "Get your bond back with a top-to-bottom move-out clean.",
    intro:
      "Moving out of a rental in Christchurch? A professional end of tenancy clean covers the kitchen, bathrooms, floors, walls and windows to the standard most property managers expect at final inspection.",
    includes: [
      "Kitchen degrease, cupboards inside and out",
      "Bathrooms descaled and sanitised",
      "Skirting, switches, doors and frames wiped",
      "Interior windows and tracks",
      "Floors vacuumed and mopped",
    ],
    faqs: [
      {
        q: "Will this guarantee my bond back?",
        a: "No cleaner can guarantee your bond. Many local businesses offer a re-clean if your property manager flags anything — ask the business that contacts you about their policy.",
      },
      {
        q: "Should I book carpets at the same time?",
        a: "Most tenancy agreements in Christchurch require carpets to be professionally cleaned at the end of the tenancy. Adding a carpet clean to the same request takes 10% off the estimate.",
      },
    ],
  },
  {
    code: "deep_clean",
    name: "Deep cleaning",
    short: "Deep clean",
    slug: "deep-cleaning-christchurch",
    group: "HOME",
    tagline: "A one-off reset for kitchens, bathrooms and everything between.",
    intro:
      "A deep clean goes well beyond a regular tidy: built-up grime in kitchens and bathrooms, skirting boards, light fittings and the spots that get skipped week to week.",
    includes: [
      "Kitchen surfaces, splashbacks and appliance exteriors",
      "Bathrooms descaled and sanitised",
      "Dusting high and low, including light fittings",
      "Skirting boards, doors and switches",
      "Floors vacuumed and mopped",
    ],
    faqs: [
      {
        q: "How long does a deep clean take?",
        a: "A typical 3-bedroom home takes a team of two around 5–7 hours. The business will confirm timing when they quote.",
      },
    ],
  },
  {
    code: "oven_clean",
    name: "Oven cleaning",
    short: "Oven",
    slug: "oven-cleaning-christchurch",
    group: "HOME",
    tagline: "Racks, glass and interior back to showroom condition.",
    intro:
      "Professional oven cleaners strip down racks, trays and door glass and remove carbonised grease with non-caustic products, usually in two to three hours.",
    includes: ["Interior, racks and trays", "Door glass (inner and outer)", "Hob and knobs", "Rangehood filters (optional)"],
    faqs: [
      {
        q: "Can I use the oven the same day?",
        a: "Usually yes — most products used are safe once the oven has been wiped down and aired.",
      },
    ],
  },
  {
    code: "carpet_clean",
    name: "Carpet cleaning",
    short: "Carpets",
    slug: "carpet-cleaning-christchurch",
    group: "CARPET",
    tagline: "Hot water extraction for fresher, healthier carpets.",
    intro:
      "Hot water extraction (steam cleaning) lifts dirt, allergens and most stains from deep in the pile. Ideal for end of tenancy, after pets, or a yearly refresh.",
    includes: ["Pre-treatment of high-traffic areas", "Hot water extraction", "Spot stain treatment", "Hallways and stairs on request"],
    faqs: [
      {
        q: "How long until the carpet is dry?",
        a: "Typically 3–6 hours depending on ventilation and the weather.",
      },
      {
        q: "Does a hallway count as a room?",
        a: "Yes — for the estimate a hallway counts as one room.",
      },
    ],
  },
  {
    code: "upholstery_clean",
    name: "Upholstery & mattress cleaning",
    short: "Upholstery",
    slug: "upholstery-cleaning-christchurch",
    group: "CARPET",
    tagline: "Couches, chairs and mattresses cleaned and sanitised.",
    intro:
      "Fabric couches, dining chairs and mattresses collect dust mites, spills and odours. A professional upholstery clean uses the right method for each fabric type.",
    includes: ["Fabric test and pre-treatment", "Low-moisture or extraction clean", "Deodorise and sanitise", "Mattress sanitising"],
    faqs: [
      {
        q: "How is a couch measured?",
        a: "By seat — a three-seater couch counts as three seats.",
      },
    ],
  },
  {
    code: "window_clean",
    name: "Window cleaning",
    short: "Windows",
    slug: "window-cleaning-christchurch",
    group: "EXTERIOR",
    tagline: "Streak-free glass, inside and out, frames and sills included.",
    intro:
      "Interior and exterior window cleaning with purified water-fed poles or traditional methods, including frames, sills and tracks.",
    includes: ["Interior and exterior glass", "Frames and sills wiped", "Tracks vacuumed", "Two-storey access"],
    faqs: [
      {
        q: "How do I count windows?",
        a: "Count each separate pane of glass that opens or is framed on its own. A rough count is fine — the business will confirm.",
      },
    ],
  },
  {
    code: "house_wash",
    name: "House washing",
    short: "House wash",
    slug: "house-washing-christchurch",
    group: "EXTERIOR",
    tagline: "Soft-wash cladding, soffits and gutters without damage.",
    intro:
      "A low-pressure soft wash removes mould, lichen and grime from weatherboards, brick and plaster, and protects paintwork. Roof washes are quoted separately on site.",
    includes: ["Cladding soft-wash", "Soffits and fascias", "Gutter exteriors", "Joinery rinse"],
    faqs: [
      {
        q: "Can you wash my roof too?",
        a: "Roof spray-washing is quoted on site because access and roof type vary. Tick the roof option and the business will include it in their quote.",
      },
    ],
  },
];

export const AREAS: AreaDef[] = [
  {
    code: "CEN",
    name: "Central",
    slug: "central-christchurch",
    priceTier: "large",
    suburbs: ["City Centre", "Riccarton", "Addington", "Sydenham", "Merivale", "St Albans", "Fendalton", "Strowan"],
    blurb: "The central city and inner suburbs, from Riccarton to St Albans.",
  },
  {
    code: "NTH",
    name: "North",
    slug: "north-christchurch",
    priceTier: "standard",
    suburbs: ["Papanui", "Bishopdale", "Redwood", "Northwood", "Casebrook", "Belfast", "Burnside", "Bryndwr", "Harewood"],
    blurb: "Papanui, Bishopdale, Redwood and the northern suburbs out to Belfast.",
  },
  {
    code: "EST",
    name: "East",
    slug: "east-christchurch",
    priceTier: "standard",
    suburbs: ["New Brighton", "Burwood", "Parklands", "Shirley", "Linwood", "Wainoni", "Aranui", "Avonside", "Dallington"],
    blurb: "Shirley and Linwood through to New Brighton and Parklands.",
  },
  {
    code: "STH",
    name: "South & Hills",
    slug: "south-and-hills-christchurch",
    priceTier: "large",
    suburbs: ["Cashmere", "Beckenham", "Spreydon", "Hoon Hay", "Halswell", "Sumner", "Redcliffs", "Mt Pleasant", "Heathcote"],
    blurb: "Cashmere, Halswell and the Port Hills, round to Sumner and Redcliffs.",
  },
  {
    code: "WST",
    name: "West",
    slug: "west-christchurch",
    priceTier: "standard",
    suburbs: ["Hornby", "Wigram", "Sockburn", "Avonhead", "Ilam", "Upper Riccarton", "Yaldhurst", "Templeton", "Russley"],
    blurb: "Ilam and Avonhead out to Hornby, Wigram and Templeton.",
  },
  {
    code: "GRT",
    name: "Greater Christchurch",
    slug: "greater-christchurch",
    priceTier: "standard",
    suburbs: ["Rolleston", "Lincoln", "Prebbleton", "Rangiora", "Kaiapoi", "Woodend", "Pegasus"],
    blurb: "Selwyn and Waimakariri towns: Rolleston, Lincoln, Rangiora, Kaiapoi and more.",
  },
];

/** Overflow adjacency (symmetric). */
export const ADJACENCY: Record<AreaCode, AreaCode[]> = {
  CEN: ["NTH", "EST", "STH", "WST"],
  NTH: ["CEN", "EST", "WST", "GRT"],
  EST: ["CEN", "NTH", "STH"],
  STH: ["CEN", "EST", "WST"],
  WST: ["CEN", "NTH", "STH", "GRT"],
  GRT: ["NTH", "WST"],
};

/** Placeholder seat prices (NZD incl. GST, per month) by area tier. */
export const SEAT_PRICE_CENTS: Record<AreaDef["priceTier"], number> = {
  standard: 14900,
  large: 19900,
};

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const SERVICE_BY_CODE = Object.fromEntries(SERVICES.map((s) => [s.code, s])) as Record<ServiceCode, ServiceDef>;
export const SERVICE_BY_SLUG = Object.fromEntries(SERVICES.map((s) => [s.slug, s])) as Record<string, ServiceDef>;
export const AREA_BY_SLUG = Object.fromEntries(AREAS.map((a) => [a.slug, a])) as Record<string, AreaDef>;
export const GROUP_BY_CODE = Object.fromEntries(GROUPS.map((g) => [g.code, g])) as Record<GroupCode, GroupDef>;

export const SERVICE_CODES = SERVICES.map((s) => s.code) as [ServiceCode, ...ServiceCode[]];

export function isServiceCode(v: string): v is ServiceCode {
  return v in SERVICE_BY_CODE;
}

/** Group a list of service codes by their seat group, preserving order. */
export function groupsForServices(services: readonly string[]): GroupCode[] {
  const out: GroupCode[] = [];
  for (const code of services) {
    const def = SERVICE_BY_CODE[code as ServiceCode];
    if (def && !out.includes(def.group)) out.push(def.group);
  }
  return out;
}

export interface SuburbOption {
  name: string;
  slug: string;
  area: AreaCode;
}

export const ALL_SUBURBS: SuburbOption[] = AREAS.flatMap((a) =>
  a.suburbs.map((name) => ({ name, slug: slugify(name), area: a.code })),
).sort((x, y) => x.name.localeCompare(y.name));
