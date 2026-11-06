import { describe, expect, it } from "vitest";
import { isQuietHours, nextQuietEnd, nzDateString, offerWindow, zonedTimeToUtc } from "@/lib/time";

describe("NZ time helpers", () => {
  it("converts NZ wall time to UTC across DST", () => {
    // NZDT (UTC+13) in November, NZST (UTC+12) in July
    expect(zonedTimeToUtc(2026, 11, 7, 7).toISOString()).toBe("2026-11-06T18:00:00.000Z");
    expect(zonedTimeToUtc(2026, 7, 1, 7).toISOString()).toBe("2026-06-30T19:00:00.000Z");
  });

  it("detects quiet hours 20:00–07:00 NZT", () => {
    expect(isQuietHours(zonedTimeToUtc(2026, 11, 6, 19, 59))).toBe(false);
    expect(isQuietHours(zonedTimeToUtc(2026, 11, 6, 20, 0))).toBe(true);
    expect(isQuietHours(zonedTimeToUtc(2026, 11, 7, 6, 59))).toBe(true);
    expect(isQuietHours(zonedTimeToUtc(2026, 11, 7, 7, 0))).toBe(false);
  });

  it("next quiet end: evening → tomorrow 07:00, early morning → today 07:00", () => {
    expect(nextQuietEnd(zonedTimeToUtc(2026, 11, 6, 22)).toISOString()).toBe(zonedTimeToUtc(2026, 11, 7, 7).toISOString());
    expect(nextQuietEnd(zonedTimeToUtc(2026, 11, 7, 3)).toISOString()).toBe(zonedTimeToUtc(2026, 11, 7, 7).toISOString());
    // Month boundary
    expect(nextQuietEnd(zonedTimeToUtc(2026, 11, 30, 23)).toISOString()).toBe(zonedTimeToUtc(2026, 12, 1, 7).toISOString());
  });

  it("offer window starts TTL at 07:00 in quiet hours", () => {
    const w = offerWindow(zonedTimeToUtc(2026, 11, 6, 21), 30);
    expect(w.deferred).toBe(true);
    expect(w.expiresAt.getTime() - w.offeredAt.getTime()).toBe(30 * 60_000);
    const d = offerWindow(zonedTimeToUtc(2026, 11, 6, 10), 30);
    expect(d.deferred).toBe(false);
  });

  it("NZ date string", () => {
    expect(nzDateString(new Date("2026-11-05T12:00:00Z"))).toBe("2026-11-06");
  });
});
