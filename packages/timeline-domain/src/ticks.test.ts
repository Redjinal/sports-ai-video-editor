import { describe, it, expect } from "vitest";
import {
  TIMESCALE,
  asTicks,
  ticksPerFrame,
  frameToTicks,
  ticksToFrame,
  ticksToSeconds,
  FRAME_RATES,
} from "./ticks";

describe("tick time model", () => {
  it("uses the canonical 27,000,000 tick timescale", () => {
    expect(TIMESCALE).toBe(27_000_000);
  });

  it("has exact integer ticks-per-frame for all supported rates", () => {
    // The whole point of 27,000,000 is that these are all integers.
    expect(ticksPerFrame(FRAME_RATES.fps24)).toBe(1_125_000);
    expect(ticksPerFrame(FRAME_RATES.fps25)).toBe(1_080_000);
    expect(ticksPerFrame(FRAME_RATES.fps30)).toBe(900_000);
    expect(ticksPerFrame(FRAME_RATES.fps60)).toBe(450_000);
    expect(ticksPerFrame(FRAME_RATES.fps23_976)).toBe(1_126_125);
    expect(ticksPerFrame(FRAME_RATES.fps29_97)).toBe(900_900);
    expect(ticksPerFrame(FRAME_RATES.fps59_94)).toBe(450_450);
    for (const rate of Object.values(FRAME_RATES)) {
      expect(Number.isInteger(ticksPerFrame(rate))).toBe(true);
    }
  });

  it("round-trips frame <-> ticks for drop-frame rates", () => {
    for (const frame of [0, 1, 100, 17983]) {
      const t = frameToTicks(frame, FRAME_RATES.fps29_97);
      expect(ticksToFrame(t, FRAME_RATES.fps29_97)).toBe(frame);
    }
  });

  it("derives seconds for display only", () => {
    expect(ticksToSeconds(asTicks(TIMESCALE))).toBe(1);
    expect(ticksToSeconds(asTicks(TIMESCALE / 2))).toBe(0.5);
  });

  it("rejects non-integer and negative ticks", () => {
    expect(() => asTicks(1.5)).toThrow();
    expect(() => asTicks(-1)).toThrow();
    expect(() => frameToTicks(2.5, FRAME_RATES.fps30)).toThrow();
  });
});
