import "server-only";
import type { GroupCode } from "@/lib/catalog";
import { adminDb } from "@/lib/supabase/admin";
import type { CreatedOffer, ExistingOffer, LeadForRouting, LeadStatus, NewOffer, RoutingStore, SeatRow } from "@/lib/routing";

/** Postgres-backed RoutingStore (service role). */
export class SupabaseRoutingStore implements RoutingStore {
  private db = adminDb();
  private groupCache: Record<GroupCode, string> | null = null;

  async getLead(leadId: string): Promise<LeadForRouting | null> {
    const { data } = await this.db
      .from("leads")
      .select("id, area_id, services, status, unrouted_groups")
      .eq("id", leadId)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      areaId: data.area_id,
      services: data.services,
      status: data.status,
      unroutedGroups: data.unrouted_groups ?? [],
    };
  }

  async groupIds(): Promise<Record<GroupCode, string>> {
    if (this.groupCache) return this.groupCache;
    const { data, error } = await this.db.from("service_groups").select("id, code");
    if (error) throw error;
    this.groupCache = Object.fromEntries((data ?? []).map((g) => [g.code, g.id])) as Record<GroupCode, string>;
    return this.groupCache;
  }

  async getOffers(leadId: string): Promise<ExistingOffer[]> {
    const { data, error } = await this.db
      .from("lead_offers")
      .select("id, partner_id, group_id, kind, round, status")
      .eq("lead_id", leadId);
    if (error) throw error;
    return (data ?? []).map((o) => ({
      id: o.id,
      partnerId: o.partner_id,
      groupId: o.group_id,
      kind: o.kind,
      round: o.round,
      status: o.status,
    }));
  }

  async getSeats(areaIds: string[], groupId: string): Promise<SeatRow[]> {
    if (areaIds.length === 0) return [];
    const { data, error } = await this.db
      .from("seats")
      .select(
        "id, partner_id, area_id, group_id, status, priority, past_due_since, paused_at, partners!inner(status, insurance_expiry, accept_rate)",
      )
      .in("area_id", areaIds)
      .eq("group_id", groupId)
      .neq("status", "cancelled");
    if (error) throw error;
    type Row = {
      id: string;
      partner_id: string;
      area_id: string;
      group_id: string;
      status: SeatRow["seatStatus"];
      priority: number;
      past_due_since: string | null;
      paused_at: string | null;
      partners: { status: SeatRow["partnerStatus"]; insurance_expiry: string | null; accept_rate: string | number | null };
    };
    return ((data ?? []) as unknown as Row[]).map((s) => ({
      seatId: s.id,
      partnerId: s.partner_id,
      areaId: s.area_id,
      groupId: s.group_id,
      seatStatus: s.status,
      priority: s.priority,
      pastDueSince: s.past_due_since,
      pausedAt: s.paused_at,
      partnerStatus: s.partners.status,
      insuranceExpiry: s.partners.insurance_expiry,
      acceptRate: s.partners.accept_rate === null ? null : Number(s.partners.accept_rate),
    }));
  }

  async getAdjacentAreaIds(areaId: string): Promise<string[]> {
    const { data, error } = await this.db.from("area_adjacency").select("adjacent_area_id").eq("area_id", areaId);
    if (error) throw error;
    return (data ?? []).map((r) => r.adjacent_area_id);
  }

  async getRecentOfferCounts(partnerIds: string[]): Promise<Record<string, number>> {
    if (partnerIds.length === 0) return {};
    const { data, error } = await this.db.rpc("partner_recent_offer_counts", { p_partner_ids: partnerIds, p_days: 7 });
    if (error) throw error;
    return Object.fromEntries(((data ?? []) as { partner_id: string; offers: number }[]).map((r) => [r.partner_id, Number(r.offers)]));
  }

  async createOffer(o: NewOffer): Promise<CreatedOffer | null> {
    const { data, error } = await this.db
      .from("lead_offers")
      .insert({
        lead_id: o.leadId,
        partner_id: o.partnerId,
        seat_id: o.seatId,
        group_id: o.groupId,
        kind: o.kind,
        round: o.round,
        offered_at: o.offeredAt.toISOString(),
        expires_at: o.expiresAt.toISOString(),
      })
      .select("id")
      .single();
    if (error) {
      // 23505 unique (partner already offered), 23514 check (cap reached): a concurrent run won.
      if (error.code === "23505" || error.code === "23514") return null;
      throw error;
    }
    return { ...o, id: data.id };
  }

  async updateLead(leadId: string, patch: { status?: LeadStatus; unroutedGroups?: string[] }): Promise<void> {
    const update: Record<string, unknown> = {};
    if (patch.status) update.status = patch.status;
    if (patch.unroutedGroups) update.unrouted_groups = patch.unroutedGroups;
    // Never resurrect a lead an admin closed or marked spam mid-routing.
    const { error } = await this.db.from("leads").update(update).eq("id", leadId).not("status", "in", "(closed,spam)");
    if (error) throw error;
  }
}
