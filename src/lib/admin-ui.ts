export const LEAD_TONE = {
  new: "neutral",
  routing: "neutral",
  offered: "brand",
  accepted: "ok",
  unrouted: "danger",
  closed: "neutral",
  spam: "warn",
} as const;

export const PARTNER_TONE = { applied: "warn", approved: "ok", suspended: "danger", churned: "neutral" } as const;
export const SEAT_TONE = { trial: "brand", active: "ok", past_due: "danger", cancelled: "neutral" } as const;

export const fmtDateTime = (d: string | null) =>
  d ? new Date(d).toLocaleString("en-NZ", { timeZone: "Pacific/Auckland", dateStyle: "medium", timeStyle: "short" }) : "—";

export const pct = (v: number | string | null) => (v === null || v === undefined ? "—" : `${Math.round(Number(v) * 100)}%`);
