export const NZ_TZ = "Pacific/Auckland";

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function zonedParts(date: Date, timeZone = NZ_TZ): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-NZ", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function tzOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Convert a wall-clock time in `timeZone` to a UTC instant (DST-safe). */
export function zonedTimeToUtc(
  y: number,
  m: number,
  d: number,
  hh: number,
  mm = 0,
  timeZone = NZ_TZ,
): Date {
  const wall = Date.UTC(y, m - 1, d, hh, mm, 0);
  let guess = wall - tzOffsetMs(new Date(wall), timeZone);
  // Second pass corrects for DST transitions between the guess and the target.
  guess = wall - tzOffsetMs(new Date(guess), timeZone);
  return new Date(guess);
}

/** Today's date in NZ as YYYY-MM-DD. */
export function nzDateString(date: Date = new Date()): string {
  const p = zonedParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export const QUIET_START_HOUR = 20;
export const QUIET_END_HOUR = 7;

export function isQuietHours(date: Date): boolean {
  const { hour } = zonedParts(date);
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
}

/** The next 07:00 NZ at or after `date` (only meaningful during quiet hours). */
export function nextQuietEnd(date: Date): Date {
  const p = zonedParts(date);
  if (p.hour < QUIET_END_HOUR) return zonedTimeToUtc(p.year, p.month, p.day, QUIET_END_HOUR);
  // After 20:00 → tomorrow 07:00. Step forward via UTC noon to get tomorrow's NZ date.
  const tomorrow = zonedParts(new Date(zonedTimeToUtc(p.year, p.month, p.day, 12).getTime() + 24 * 3600 * 1000));
  return zonedTimeToUtc(tomorrow.year, tomorrow.month, tomorrow.day, QUIET_END_HOUR);
}

/**
 * When an offer created at `now` becomes live and when it expires.
 * During quiet hours (20:00–07:00 NZT) the offer is deferred to 07:00 and
 * its TTL starts then.
 */
export function offerWindow(now: Date, ttlMinutes: number): { offeredAt: Date; expiresAt: Date; deferred: boolean } {
  const deferred = isQuietHours(now);
  const offeredAt = deferred ? nextQuietEnd(now) : now;
  return { offeredAt, expiresAt: new Date(offeredAt.getTime() + ttlMinutes * 60_000), deferred };
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}
