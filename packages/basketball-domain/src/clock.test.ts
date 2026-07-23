import { describe, it, expect } from "vitest";
import { asTicks } from "@sve/timeline-domain";
import { gameClockToTicks, ticksToGameClock, type ClockAnchor } from "./clock";

function t(n: number) {
  return asTicks(n);
}

describe("gameClockToTicks / ticksToGameClock", () => {
  const anchors: ClockAnchor[] = [
    { id: "a1", period: 1, gameClockMs: 600_000, atTicks: t(0) },
    { id: "a2", period: 1, gameClockMs: 300_000, atTicks: t(1_000_000) }, // a stoppage happened here
    { id: "a3", period: 1, gameClockMs: 0, atTicks: t(2_500_000) },
    { id: "b1", period: 2, gameClockMs: 600_000, atTicks: t(3_000_000) },
    { id: "b2", period: 2, gameClockMs: 0, atTicks: t(4_000_000) },
  ];

  it("interpolates linearly within an anchor segment", () => {
    // Halfway between a1 (600000ms @ 0) and a2 (300000ms @ 1,000,000): 450000ms @ 500,000.
    const ticks = gameClockToTicks(anchors, { period: 1, gameClockMs: 450_000 });
    expect(ticks).toBe(500_000);
    const reading = ticksToGameClock(anchors, t(500_000));
    expect(reading).toEqual({ period: 1, gameClockMs: 450_000 });
  });

  it("resolves the game clock differently either side of a stoppage segment boundary", () => {
    // Same real elapsed-ticks interval, but different ms/tick rate across the stoppage.
    const before = gameClockToTicks(anchors, { period: 1, gameClockMs: 350_000 }); // in [a1,a2]
    const after = gameClockToTicks(anchors, { period: 1, gameClockMs: 250_000 }); // in [a2,a3]
    expect(before).toBeLessThan(1_000_000);
    expect(after).toBeGreaterThan(1_000_000);
  });

  it("clamps to the nearest anchor outside the anchored range for a period", () => {
    expect(gameClockToTicks(anchors, { period: 1, gameClockMs: 900_000 })).toBe(0);
    expect(gameClockToTicks(anchors, { period: 1, gameClockMs: -100 })).toBe(2_500_000);
  });

  it("round-trips exact anchor readings", () => {
    for (const a of anchors) {
      expect(gameClockToTicks(anchors, { period: a.period, gameClockMs: a.gameClockMs })).toBe(
        a.atTicks,
      );
      expect(ticksToGameClock(anchors, a.atTicks)).toEqual({
        period: a.period,
        gameClockMs: a.gameClockMs,
      });
    }
  });

  it("resolves a single-anchor period to that anchor's ticks", () => {
    const single: ClockAnchor[] = [
      { id: "only", period: 3, gameClockMs: 300_000, atTicks: t(9_000_000) },
    ];
    expect(gameClockToTicks(single, { period: 3, gameClockMs: 100_000 })).toBe(9_000_000);
  });

  it("throws for a period with no anchors", () => {
    expect(() => gameClockToTicks(anchors, { period: 99, gameClockMs: 0 })).toThrow();
  });

  it("attributes ticks near a period boundary to the nearer anchor", () => {
    // Between a3 (period 1 end, 2,500,000) and b1 (period 2 start, 3,000,000), no anchor
    // marks the exact boundary; a tick closer to a3 resolves to period 1, closer to b1 to 2.
    expect(ticksToGameClock(anchors, t(2_600_000)).period).toBe(1);
    expect(ticksToGameClock(anchors, t(2_900_000)).period).toBe(2);
  });

  it("clamps ticksToGameClock outside the overall anchored range", () => {
    expect(ticksToGameClock(anchors, t(0)).period).toBe(1);
    expect(ticksToGameClock(anchors, t(5_000_000))).toEqual({ period: 2, gameClockMs: 0 });
  });

  it("throws when no anchors are provided at all", () => {
    expect(() => ticksToGameClock([], t(0))).toThrow();
  });
});
