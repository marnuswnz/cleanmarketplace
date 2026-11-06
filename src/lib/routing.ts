/**
 * Lead routing engine.
 *
 * The pure planning functions (eligibility, ranking, planGroup) contain all
 * the business rules and are unit-tested directly. `routeLead` orchestrates
 * them against a `RoutingStore` (Supabase in production, in-memory in tests)
 * and a `RoutingNotifier` (SMS/email).
 *
 * Invariants (also enforced in Postgres by triggers/RPCs):
 *   - at most `maxPartners` live (offered|accepted) offers per lead/group
 *   - a partner is offered a given lead/group at most once
 *   - a customer is never given more than `maxPartners` businesses per group
 */
import { groupsForServices, type GroupCode } from "@/lib/catalog";
import { nzDateString, offerWindow } from "@/lib/time";

export const PAST_DUE_GRACE_DAYS = 7;
export const MAX_OVERFLOW_ROUNDS = 2;
/** Accept rate used for ranking partners with no history yet. */
export const NEUTRAL_ACCEPT_RATE = 0.75;

export interface RoutingConfig {
  maxPartners: number;
  offerTtlMinutes: number;
  maxOverflowRounds: number;
}

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------
export type SeatStatus = "trial" | "active" | "past_due" | "cancelled";
export type PartnerStatus = "applied" | "approved" | "suspended" | "churned";

export interface SeatRow {
  seatId: string;
  partnerId: string;
  areaId: string;
  groupId: string;
  seatStatus: SeatStatus;
  priority: number;
  pastDueSince: string | null;
  pausedAt: string | null;
  partnerStatus: PartnerStatus;
  /** YYYY-MM-DD */
  insuranceExpiry: string | null;
  acceptRate: number | null;
}

export type IneligibleReason =
  | "seat_cancelled"
  | "seat_past_due"
  | "seat_paused"
  | "partner_not_approved"
  | "insurance_missing"
  | "insurance_expired";

/** Why a seat cannot receive new offers, or null if it can. */
export function seatIneligibility(seat: SeatRow, now: Date): IneligibleReason | null {
  if (seat.partnerStatus !== "approved") return "partner_not_approved";
  if (seat.seatStatus === "cancelled") return "seat_cancelled";
  if (seat.seatStatus === "past_due") {
    const since = seat.pastDueSince ? new Date(seat.pastDueSince).getTime() : now.getTime();
    if (now.getTime() - since > PAST_DUE_GRACE_DAYS * 86_400_000) return "seat_past_due";
  }
  if (seat.pausedAt) return "seat_paused";
  if (!seat.insuranceExpiry) return "insurance_missing";
  if (seat.insuranceExpiry < nzDateString(now)) return "insurance_expired";
  return null;
}

export const isSeatEligible = (seat: SeatRow, now: Date) => seatIneligibility(seat, now) === null;

// ---------------------------------------------------------------------------
// Ranking: priority desc → accept_rate desc → fewest offers in last 7 days
// ---------------------------------------------------------------------------
export interface Candidate extends SeatRow {
  recentOffers: number;
}

export function rankCandidates(cands: Candidate[]): Candidate[] {
  return [...cands].sort(
    (a, b) =>
      b.priority - a.priority ||
      (b.acceptRate ?? NEUTRAL_ACCEPT_RATE) - (a.acceptRate ?? NEUTRAL_ACCEPT_RATE) ||
      a.recentOffers - b.recentOffers ||
      a.partnerId.localeCompare(b.partnerId),
  );
}

/** Keep one candidate per partner (the best-ranked one). */
export function dedupeByPartner(cands: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return rankCandidates(cands).filter((c) => (seen.has(c.partnerId) ? false : (seen.add(c.partnerId), true)));
}

// ---------------------------------------------------------------------------
// Per-group planning
// ---------------------------------------------------------------------------
export type OfferStatus = "offered" | "accepted" | "declined" | "expired" | "cancelled";

export interface ExistingOffer {
  id: string;
  partnerId: string;
  groupId: string;
  kind: "seat" | "overflow";
  round: number;
  status: OfferStatus;
}

export interface GroupPlanInput {
  existing: ExistingOffer[];
  /** Eligible seat holders in the lead's area for this group. */
  seatCandidates: Candidate[];
  /** Eligible seat holders in adjacent areas for this group. */
  overflowCandidates: Candidate[];
  config: Pick<RoutingConfig, "maxPartners" | "maxOverflowRounds">;
}

export type GroupPlan =
  | { action: "offer"; kind: "seat" | "overflow"; round: number; picks: Candidate[] }
  | { action: "wait" }
  | { action: "done" }
  | { action: "unrouted" };

export function planGroup({ existing, seatCandidates, overflowCandidates, config }: GroupPlanInput): GroupPlan {
  const accepted = existing.filter((o) => o.status === "accepted").length;
  const pending = existing.filter((o) => o.status === "offered").length;
  if (accepted >= config.maxPartners) return { action: "done" };

  const slots = config.maxPartners - accepted - pending;
  if (slots <= 0) return { action: "wait" };

  const alreadyOffered = new Set(existing.map((o) => o.partnerId));
  const fresh = (c: Candidate) => !alreadyOffered.has(c.partnerId);

  const seats = dedupeByPartner(seatCandidates.filter(fresh));
  if (seats.length > 0) {
    return { action: "offer", kind: "seat", round: 1, picks: seats.slice(0, slots) };
  }

  // No seat holders left → overflow to adjacent areas, in at most N rounds.
  const overflow = existing.filter((o) => o.kind === "overflow");
  const lastRound = overflow.reduce((m, o) => Math.max(m, o.round), 0);
  const roundOpen = overflow.some((o) => o.round === lastRound && o.status === "offered");
  const exhausted = (): GroupPlan => (pending > 0 ? { action: "wait" } : accepted > 0 ? { action: "done" } : { action: "unrouted" });

  if (roundOpen) return { action: "wait" };
  const nextRound = lastRound + 1;
  if (nextRound > config.maxOverflowRounds) return exhausted();

  const picks = dedupeByPartner(overflowCandidates.filter(fresh)).slice(0, slots);
  if (picks.length === 0) return exhausted();
  return { action: "offer", kind: "overflow", round: nextRound, picks };
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------
export type LeadStatus = "new" | "routing" | "offered" | "accepted" | "unrouted" | "closed" | "spam";

export interface LeadForRouting {
  id: string;
  areaId: string;
  services: string[];
  status: LeadStatus;
  unroutedGroups: string[];
}

export interface NewOffer {
  leadId: string;
  partnerId: string;
  seatId: string | null;
  groupId: string;
  kind: "seat" | "overflow";
  round: number;
  offeredAt: Date;
  expiresAt: Date;
}

export interface CreatedOffer extends NewOffer {
  id: string;
}

export interface RoutingStore {
  getLead(leadId: string): Promise<LeadForRouting | null>;
  groupIds(): Promise<Record<GroupCode, string>>;
  getOffers(leadId: string): Promise<ExistingOffer[]>;
  getSeats(areaIds: string[], groupId: string): Promise<SeatRow[]>;
  getAdjacentAreaIds(areaId: string): Promise<string[]>;
  getRecentOfferCounts(partnerIds: string[]): Promise<Record<string, number>>;
  /** Insert one offer; returns null if a DB invariant rejected it. */
  createOffer(offer: NewOffer): Promise<CreatedOffer | null>;
  updateLead(leadId: string, patch: { status?: LeadStatus; unroutedGroups?: string[] }): Promise<void>;
}

export interface RoutingNotifier {
  /** Called for offers that are live now (not deferred by quiet hours). */
  offerCreated(offer: CreatedOffer): Promise<void>;
  groupUnrouted(leadId: string, group: GroupCode): Promise<void>;
}

export interface RouteResult {
  leadId: string;
  status: LeadStatus;
  groups: Record<string, GroupPlan["action"]>;
  created: CreatedOffer[];
}

export async function routeLead(
  store: RoutingStore,
  notifier: RoutingNotifier,
  leadId: string,
  config: RoutingConfig,
  now: Date = new Date(),
): Promise<RouteResult | null> {
  const lead = await store.getLead(leadId);
  if (!lead) return null;
  if (lead.status === "closed" || lead.status === "spam") {
    return { leadId, status: lead.status, groups: {}, created: [] };
  }

  const groupIdByCode = await store.groupIds();
  const groups = groupsForServices(lead.services);
  const adjacent = await store.getAdjacentAreaIds(lead.areaId);
  const created: CreatedOffer[] = [];
  const outcome: Record<string, GroupPlan["action"]> = {};
  const unrouted = new Set(lead.unroutedGroups);
  const newlyUnrouted: GroupCode[] = [];

  for (const code of groups) {
    const groupId = groupIdByCode[code];
    if (!groupId) continue;

    // Loop so that if the DB rejects a pick (race), we re-plan immediately.
    for (let attempt = 0; attempt < 3; attempt++) {
      const existing = (await store.getOffers(leadId)).filter((o) => o.groupId === groupId);
      const seats = (await store.getSeats([lead.areaId, ...adjacent], groupId)).filter((s) => isSeatEligible(s, now));
      const counts = await store.getRecentOfferCounts([...new Set(seats.map((s) => s.partnerId))]);
      const withCounts = seats.map((s) => ({ ...s, recentOffers: counts[s.partnerId] ?? 0 }));
      const home = withCounts.filter((s) => s.areaId === lead.areaId);
      const homePartners = new Set(home.map((s) => s.partnerId));
      const overflowCands = withCounts.filter((s) => s.areaId !== lead.areaId && !homePartners.has(s.partnerId));

      const plan = planGroup({ existing, seatCandidates: home, overflowCandidates: overflowCands, config });
      outcome[code] = plan.action;

      if (plan.action === "unrouted") {
        if (!unrouted.has(code)) newlyUnrouted.push(code);
        unrouted.add(code);
        break;
      }
      unrouted.delete(code);
      if (plan.action !== "offer") break;

      const window = offerWindow(now, config.offerTtlMinutes);
      let rejected = false;
      for (const pick of plan.picks) {
        const offer = await store.createOffer({
          leadId,
          partnerId: pick.partnerId,
          seatId: plan.kind === "seat" ? pick.seatId : null,
          groupId,
          kind: plan.kind,
          round: plan.round,
          offeredAt: window.offeredAt,
          expiresAt: window.expiresAt,
        });
        if (!offer) {
          rejected = true;
          continue;
        }
        created.push(offer);
        if (!window.deferred) await notifier.offerCreated(offer);
      }
      if (!rejected) break;
    }
  }

  const all = await store.getOffers(leadId);
  const status: LeadStatus = all.some((o) => o.status === "accepted")
    ? "accepted"
    : all.some((o) => o.status === "offered")
      ? "offered"
      : groups.length > 0 && groups.every((g) => unrouted.has(g))
        ? "unrouted"
        : "routing";

  await store.updateLead(leadId, { status, unroutedGroups: [...unrouted] });
  for (const g of newlyUnrouted) await notifier.groupUnrouted(leadId, g);

  return { leadId, status, groups: outcome, created };
}
