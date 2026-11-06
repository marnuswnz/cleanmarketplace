import type { GroupCode } from "@/lib/catalog";
import type {
  CreatedOffer,
  ExistingOffer,
  LeadForRouting,
  LeadStatus,
  NewOffer,
  RoutingNotifier,
  RoutingStore,
  SeatRow,
} from "@/lib/routing";

export interface MemOffer extends CreatedOffer {
  status: ExistingOffer["status"];
}

/** In-memory RoutingStore mirroring the DB invariants (offer cap, one offer per partner/group). */
export class MemoryStore implements RoutingStore {
  leads = new Map<string, LeadForRouting>();
  offers: MemOffer[] = [];
  seats: SeatRow[] = [];
  adjacency: Record<string, string[]> = {};
  recent: Record<string, number> = {};
  groups: Record<GroupCode, string> = { HOME: "g-home", CARPET: "g-carpet", EXTERIOR: "g-ext" };
  maxPartners = 2;
  private seq = 0;

  async getLead(id: string) {
    return this.leads.get(id) ?? null;
  }
  async groupIds() {
    return this.groups;
  }
  async getOffers(leadId: string): Promise<ExistingOffer[]> {
    return this.offers.filter((o) => o.leadId === leadId);
  }
  async getSeats(areaIds: string[], groupId: string) {
    return this.seats.filter((s) => areaIds.includes(s.areaId) && s.groupId === groupId);
  }
  async getAdjacentAreaIds(areaId: string) {
    return this.adjacency[areaId] ?? [];
  }
  async getRecentOfferCounts(ids: string[]) {
    return Object.fromEntries(ids.map((id) => [id, this.recent[id] ?? 0]));
  }
  async createOffer(o: NewOffer): Promise<CreatedOffer | null> {
    const cell = this.offers.filter((x) => x.leadId === o.leadId && x.groupId === o.groupId);
    if (cell.some((x) => x.partnerId === o.partnerId)) return null;
    if (cell.filter((x) => x.status === "offered" || x.status === "accepted").length >= this.maxPartners) return null;
    const created = { ...o, id: `offer-${++this.seq}`, status: "offered" as const };
    this.offers.push(created);
    return created;
  }
  async updateLead(id: string, patch: { status?: LeadStatus; unroutedGroups?: string[] }) {
    const l = this.leads.get(id)!;
    if (patch.status) l.status = patch.status;
    if (patch.unroutedGroups) l.unroutedGroups = patch.unroutedGroups;
  }

  // Test helpers
  setStatus(offerId: string, status: ExistingOffer["status"]) {
    this.offers.find((o) => o.id === offerId)!.status = status;
  }
  offersFor(leadId: string, group: GroupCode) {
    return this.offers.filter((o) => o.leadId === leadId && o.groupId === this.groups[group]);
  }
}

export class RecordingNotifier implements RoutingNotifier {
  notified: CreatedOffer[] = [];
  unrouted: { leadId: string; group: GroupCode }[] = [];
  async offerCreated(o: CreatedOffer) {
    this.notified.push(o);
  }
  async groupUnrouted(leadId: string, group: GroupCode) {
    this.unrouted.push({ leadId, group });
  }
}

export function seat(partial: Partial<SeatRow> & Pick<SeatRow, "partnerId" | "areaId" | "groupId">): SeatRow {
  return {
    seatId: `seat-${partial.partnerId}-${partial.areaId}-${partial.groupId}`,
    seatStatus: "active",
    priority: 0,
    pastDueSince: null,
    pausedAt: null,
    partnerStatus: "approved",
    insuranceExpiry: "2099-01-01",
    acceptRate: null,
    ...partial,
  };
}
