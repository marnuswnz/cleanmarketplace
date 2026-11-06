import { beforeEach, describe, expect, it } from "vitest";
import {
  dedupeByPartner,
  planGroup,
  rankCandidates,
  routeLead,
  seatIneligibility,
  type Candidate,
  type RoutingConfig,
} from "@/lib/routing";
import { MemoryStore, RecordingNotifier, seat } from "./memory-store";

const CONFIG: RoutingConfig = { maxPartners: 2, offerTtlMinutes: 30, maxOverflowRounds: 2 };
// Thursday 6 Nov 2026, 10:00 NZDT (UTC+13) → 21:00 UTC on 5 Nov
const DAYTIME = new Date("2026-11-05T21:00:00Z");
// 22:30 NZDT → 09:30 UTC
const NIGHT = new Date("2026-11-06T09:30:00Z");

const CEN = "area-cen";
const NTH = "area-nth";
const WST = "area-wst";

const cand = (p: Partial<Candidate> & { partnerId: string }): Candidate => ({
  ...seat({ areaId: CEN, groupId: "g-home", ...p }),
  recentOffers: 0,
  ...p,
});

describe("seat eligibility", () => {
  const base = seat({ partnerId: "p", areaId: CEN, groupId: "g-home" });

  it("eligible: approved partner, active seat, insured", () => {
    expect(seatIneligibility(base, DAYTIME)).toBeNull();
    expect(seatIneligibility({ ...base, seatStatus: "trial" }, DAYTIME)).toBeNull();
  });

  it("suspended / applied / churned partner receives nothing", () => {
    for (const s of ["suspended", "applied", "churned"] as const) {
      expect(seatIneligibility({ ...base, partnerStatus: s }, DAYTIME)).toBe("partner_not_approved");
    }
  });

  it("expired insurance receives nothing (expiry today is still OK)", () => {
    expect(seatIneligibility({ ...base, insuranceExpiry: "2026-11-05" }, DAYTIME)).toBe("insurance_expired");
    expect(seatIneligibility({ ...base, insuranceExpiry: "2026-11-06" }, DAYTIME)).toBeNull();
    expect(seatIneligibility({ ...base, insuranceExpiry: null }, DAYTIME)).toBe("insurance_missing");
  });

  it("past-due seat keeps routing for 7 days, then stops", () => {
    const sixDays = new Date(DAYTIME.getTime() - 6 * 86_400_000).toISOString();
    const eightDays = new Date(DAYTIME.getTime() - 8 * 86_400_000).toISOString();
    expect(seatIneligibility({ ...base, seatStatus: "past_due", pastDueSince: sixDays }, DAYTIME)).toBeNull();
    expect(seatIneligibility({ ...base, seatStatus: "past_due", pastDueSince: eightDays }, DAYTIME)).toBe("seat_past_due");
  });

  it("cancelled or paused seats receive nothing", () => {
    expect(seatIneligibility({ ...base, seatStatus: "cancelled" }, DAYTIME)).toBe("seat_cancelled");
    expect(seatIneligibility({ ...base, pausedAt: DAYTIME.toISOString() }, DAYTIME)).toBe("seat_paused");
  });
});

describe("ranking", () => {
  it("priority desc → accept_rate desc → fewest recent offers", () => {
    const ranked = rankCandidates([
      cand({ partnerId: "a", priority: 0, acceptRate: 0.9, recentOffers: 0 }),
      cand({ partnerId: "b", priority: 1, acceptRate: 0.5, recentOffers: 9 }),
      cand({ partnerId: "c", priority: 0, acceptRate: 0.9, recentOffers: 3 }),
      cand({ partnerId: "d", priority: 0, acceptRate: 0.95, recentOffers: 5 }),
    ]);
    expect(ranked.map((c) => c.partnerId)).toEqual(["b", "d", "a", "c"]);
  });

  it("dedupes partners, keeping their best seat", () => {
    const out = dedupeByPartner([cand({ partnerId: "a", priority: 0 }), cand({ partnerId: "a", priority: 5, seatId: "best" })]);
    expect(out).toHaveLength(1);
    expect(out[0].seatId).toBe("best");
  });
});

describe("planGroup", () => {
  const cfg = { maxPartners: 2, maxOverflowRounds: 2 };

  it("offers to up to 2 seat holders", () => {
    const plan = planGroup({
      existing: [],
      seatCandidates: [cand({ partnerId: "a" }), cand({ partnerId: "b" }), cand({ partnerId: "c" })],
      overflowCandidates: [],
      config: cfg,
    });
    expect(plan).toMatchObject({ action: "offer", kind: "seat" });
    if (plan.action === "offer") expect(plan.picks).toHaveLength(2);
  });

  it("waits while 2 offers are pending", () => {
    const existing = ["a", "b"].map((p, i) => ({ id: `${i}`, partnerId: p, groupId: "g", kind: "seat" as const, round: 1, status: "offered" as const }));
    expect(planGroup({ existing, seatCandidates: [cand({ partnerId: "c" })], overflowCandidates: [], config: cfg }).action).toBe("wait");
  });

  it("is done once 2 have accepted", () => {
    const existing = ["a", "b"].map((p, i) => ({ id: `${i}`, partnerId: p, groupId: "g", kind: "seat" as const, round: 1, status: "accepted" as const }));
    expect(planGroup({ existing, seatCandidates: [cand({ partnerId: "c" })], overflowCandidates: [], config: cfg }).action).toBe("done");
  });

  it("never re-offers a partner who already had this lead", () => {
    const existing = [{ id: "1", partnerId: "a", groupId: "g", kind: "seat" as const, round: 1, status: "declined" as const }];
    const plan = planGroup({ existing, seatCandidates: [cand({ partnerId: "a" })], overflowCandidates: [], config: cfg });
    expect(plan.action).toBe("unrouted");
  });

  it("falls back to overflow, at most 2 rounds, then unrouted", () => {
    const overflowCandidates = ["x", "y", "z", "w", "v"].map((p) => cand({ partnerId: p, areaId: NTH }));
    const r1 = planGroup({ existing: [], seatCandidates: [], overflowCandidates, config: cfg });
    expect(r1).toMatchObject({ action: "offer", kind: "overflow", round: 1 });

    const expired = (p: string, round: number) => ({ id: p, partnerId: p, groupId: "g", kind: "overflow" as const, round, status: "expired" as const });
    const r2 = planGroup({ existing: [expired("x", 1), expired("y", 1)], seatCandidates: [], overflowCandidates, config: cfg });
    expect(r2).toMatchObject({ action: "offer", kind: "overflow", round: 2 });

    const r3 = planGroup({
      existing: [expired("x", 1), expired("y", 1), expired("z", 2), expired("w", 2)],
      seatCandidates: [],
      overflowCandidates,
      config: cfg,
    });
    expect(r3.action).toBe("unrouted");
  });
});

describe("routeLead (integration with in-memory store)", () => {
  let store: MemoryStore;
  let notifier: RecordingNotifier;

  beforeEach(() => {
    store = new MemoryStore();
    notifier = new RecordingNotifier();
    store.adjacency = { [CEN]: [NTH, WST], [NTH]: [CEN], [WST]: [CEN] };
    // Riccarton (Central): 3 HOME seat holders... but the cell cap is 2 in the DB; use 2 + one overflow.
    store.seats = [
      seat({ partnerId: "home-1", areaId: CEN, groupId: "g-home", priority: 1 }),
      seat({ partnerId: "home-2", areaId: CEN, groupId: "g-home" }),
      seat({ partnerId: "home-n", areaId: NTH, groupId: "g-home" }),
      seat({ partnerId: "carpet-1", areaId: CEN, groupId: "g-carpet" }),
      seat({ partnerId: "carpet-2", areaId: CEN, groupId: "g-carpet" }),
      seat({ partnerId: "carpet-w", areaId: WST, groupId: "g-carpet" }),
    ];
    store.leads.set("lead-1", {
      id: "lead-1",
      areaId: CEN,
      services: ["end_of_tenancy", "carpet_clean"],
      status: "new",
      unroutedGroups: [],
    });
  });

  it("Riccarton EOT + carpet → ≤2 HOME and ≤2 CARPET offers, notified immediately", async () => {
    const res = await routeLead(store, notifier, "lead-1", CONFIG, DAYTIME);
    expect(res?.status).toBe("offered");
    expect(store.offersFor("lead-1", "HOME").map((o) => o.partnerId).sort()).toEqual(["home-1", "home-2"]);
    expect(store.offersFor("lead-1", "CARPET").map((o) => o.partnerId).sort()).toEqual(["carpet-1", "carpet-2"]);
    expect(store.offers.every((o) => o.kind === "seat")).toBe(true);
    expect(notifier.notified).toHaveLength(4);
    // TTL 30 minutes from now
    expect(store.offers[0].expiresAt.getTime() - DAYTIME.getTime()).toBe(30 * 60_000);
  });

  it("quiet hours: offers are deferred to 07:00 NZT and not notified now", async () => {
    await routeLead(store, notifier, "lead-1", CONFIG, NIGHT);
    expect(notifier.notified).toHaveLength(0);
    const o = store.offers[0];
    // 07:00 NZDT on 7 Nov = 18:00 UTC on 6 Nov
    expect(o.offeredAt.toISOString()).toBe("2026-11-06T18:00:00.000Z");
    expect(o.expiresAt.toISOString()).toBe("2026-11-06T18:30:00.000Z");
  });

  it("re-routing is idempotent while offers are pending", async () => {
    await routeLead(store, notifier, "lead-1", CONFIG, DAYTIME);
    await routeLead(store, notifier, "lead-1", CONFIG, DAYTIME);
    expect(store.offers).toHaveLength(4);
  });

  it("an expired offer moves to the next eligible partner (overflow)", async () => {
    await routeLead(store, notifier, "lead-1", CONFIG, DAYTIME);
    const home1 = store.offersFor("lead-1", "HOME").find((o) => o.partnerId === "home-1")!;
    store.setStatus(home1.id, "expired");
    await routeLead(store, notifier, "lead-1", CONFIG, DAYTIME);
    const home = store.offersFor("lead-1", "HOME");
    expect(home.map((o) => o.partnerId)).toEqual(["home-1", "home-2", "home-n"]);
    expect(home.at(-1)).toMatchObject({ kind: "overflow", round: 1, seatId: null });
  });

  it("customer never gets more than 2 businesses per group", async () => {
    await routeLead(store, notifier, "lead-1", CONFIG, DAYTIME);
    const [a, b] = store.offersFor("lead-1", "HOME");
    store.setStatus(a.id, "accepted");
    store.setStatus(b.id, "accepted");
    await routeLead(store, notifier, "lead-1", CONFIG, DAYTIME);
    expect(store.offersFor("lead-1", "HOME")).toHaveLength(2);
    expect(store.leads.get("lead-1")!.status).toBe("accepted");
  });

  it("one accepted + one declined → offers one more partner only", async () => {
    await routeLead(store, notifier, "lead-1", CONFIG, DAYTIME);
    const [a, b] = store.offersFor("lead-1", "HOME");
    store.setStatus(a.id, "accepted");
    store.setStatus(b.id, "declined");
    await routeLead(store, notifier, "lead-1", CONFIG, DAYTIME);
    const live = store.offersFor("lead-1", "HOME").filter((o) => o.status === "offered" || o.status === "accepted");
    expect(live).toHaveLength(2);
  });

  it("suspended partner, expired insurance and >7 day past-due seats get no offers", async () => {
    const longAgo = new Date(DAYTIME.getTime() - 10 * 86_400_000).toISOString();
    store.seats = [
      seat({ partnerId: "suspended", areaId: CEN, groupId: "g-home", partnerStatus: "suspended" }),
      seat({ partnerId: "uninsured", areaId: CEN, groupId: "g-home", insuranceExpiry: "2026-01-01" }),
      seat({ partnerId: "overdue", areaId: NTH, groupId: "g-home", seatStatus: "past_due", pastDueSince: longAgo }),
      seat({ partnerId: "ok", areaId: CEN, groupId: "g-carpet" }),
    ];
    await routeLead(store, notifier, "lead-1", CONFIG, DAYTIME);
    const partners = store.offers.map((o) => o.partnerId);
    expect(partners).toEqual(["ok"]);
    expect(store.leads.get("lead-1")!.unroutedGroups).toEqual(["HOME"]);
    expect(notifier.unrouted).toEqual([{ leadId: "lead-1", group: "HOME" }]);
  });

  it("no coverage at all → lead unrouted, admin alerted once", async () => {
    store.seats = [];
    const r = await routeLead(store, notifier, "lead-1", CONFIG, DAYTIME);
    expect(r?.status).toBe("unrouted");
    await routeLead(store, notifier, "lead-1", CONFIG, DAYTIME);
    expect(notifier.unrouted).toHaveLength(2); // HOME + CARPET, not repeated
  });

  it("does not route closed or spam leads", async () => {
    store.leads.get("lead-1")!.status = "spam";
    await routeLead(store, notifier, "lead-1", CONFIG, DAYTIME);
    expect(store.offers).toHaveLength(0);
  });

  it("overflow candidates never include partners who already hold a home seat", async () => {
    store.seats.push(seat({ partnerId: "home-1", areaId: NTH, groupId: "g-home" }));
    await routeLead(store, notifier, "lead-1", CONFIG, DAYTIME);
    const ids = store.offersFor("lead-1", "HOME").map((o) => o.partnerId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
