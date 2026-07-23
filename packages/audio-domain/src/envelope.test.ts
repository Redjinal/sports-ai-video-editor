import { describe, it, expect } from "vitest";
import { asTicks, TIMESCALE } from "@sve/timeline-domain";
import {
  constantEnvelope,
  pointsEnvelope,
  evaluateEnvelope,
  fadeIn,
  fadeOut,
  crossfade,
} from "./envelope";
import { dbToGain } from "./gain";

describe("evaluateEnvelope", () => {
  it("returns the fixed level everywhere for a constant envelope", () => {
    const env = constantEnvelope(-4.5);
    expect(evaluateEnvelope(env, asTicks(0))).toBe(-4.5);
    expect(evaluateEnvelope(env, asTicks(TIMESCALE * 100))).toBe(-4.5);
  });

  it("interpolates linearly between two finite dB points", () => {
    const env = pointsEnvelope([
      { atTicks: asTicks(0), db: -12 },
      { atTicks: asTicks(TIMESCALE), db: 0 },
    ]);
    expect(evaluateEnvelope(env, asTicks(0))).toBeCloseTo(-12, 9);
    expect(evaluateEnvelope(env, asTicks(TIMESCALE / 2))).toBeCloseTo(-6, 9);
    expect(evaluateEnvelope(env, asTicks(TIMESCALE))).toBeCloseTo(0, 9);
  });

  it("holds the first point's value before the envelope's span (clamped)", () => {
    const env = pointsEnvelope([
      { atTicks: asTicks(TIMESCALE), db: -10 },
      { atTicks: asTicks(TIMESCALE * 2), db: 0 },
    ]);
    expect(evaluateEnvelope(env, asTicks(0))).toBe(-10);
  });

  it("holds the last point's value after the envelope's span (clamped)", () => {
    const env = pointsEnvelope([
      { atTicks: asTicks(0), db: -10 },
      { atTicks: asTicks(TIMESCALE), db: -2 },
    ]);
    expect(evaluateEnvelope(env, asTicks(TIMESCALE * 10))).toBe(-2);
  });

  it("sorts unordered points before interpolating", () => {
    const env = pointsEnvelope([
      { atTicks: asTicks(TIMESCALE), db: 0 },
      { atTicks: asTicks(0), db: -12 },
    ]);
    expect(evaluateEnvelope(env, asTicks(TIMESCALE / 2))).toBeCloseTo(-6, 9);
  });

  it("interpolates across multiple segments", () => {
    const env = pointsEnvelope([
      { atTicks: asTicks(0), db: -20 },
      { atTicks: asTicks(TIMESCALE), db: 0 },
      { atTicks: asTicks(TIMESCALE * 2), db: -20 },
    ]);
    expect(evaluateEnvelope(env, asTicks(TIMESCALE))).toBeCloseTo(0, 9);
    expect(evaluateEnvelope(env, asTicks(TIMESCALE * 1.5))).toBeCloseTo(-10, 9);
  });
});

describe("fades", () => {
  it("fade-in ramps gain from 0 (silence) to unity across its span", () => {
    const start = asTicks(0);
    const duration = asTicks(TIMESCALE);
    const env = fadeIn(start, duration);

    expect(dbToGain(evaluateEnvelope(env, start))).toBe(0);
    expect(dbToGain(evaluateEnvelope(env, asTicks(TIMESCALE)))).toBeCloseTo(1, 9);

    const midGain = dbToGain(evaluateEnvelope(env, asTicks(TIMESCALE / 2)));
    expect(midGain).toBeGreaterThan(0);
    expect(midGain).toBeLessThan(1);
    expect(midGain).toBeCloseTo(0.5, 9); // fades ramp linearly in gain, not in dB
  });

  it("fade-in is held at unity after its span and at silence before it", () => {
    const env = fadeIn(asTicks(TIMESCALE), asTicks(TIMESCALE));
    expect(dbToGain(evaluateEnvelope(env, asTicks(0)))).toBe(0);
    expect(dbToGain(evaluateEnvelope(env, asTicks(TIMESCALE * 10)))).toBeCloseTo(1, 9);
  });

  it("fade-out ramps gain from unity down to 0 (silence) across its span", () => {
    const start = asTicks(0);
    const duration = asTicks(TIMESCALE);
    const env = fadeOut(start, duration);

    expect(dbToGain(evaluateEnvelope(env, start))).toBeCloseTo(1, 9);
    expect(dbToGain(evaluateEnvelope(env, asTicks(TIMESCALE)))).toBe(0);

    const midGain = dbToGain(evaluateEnvelope(env, asTicks(TIMESCALE / 2)));
    expect(midGain).toBeCloseTo(0.5, 9);
  });

  it("crossfade returns a fade-out for the outgoing side and a fade-in for the incoming side", () => {
    const start = asTicks(0);
    const duration = asTicks(TIMESCALE);
    const { outgoing, incoming } = crossfade(start, duration);

    expect(dbToGain(evaluateEnvelope(outgoing, start))).toBeCloseTo(1, 9);
    expect(dbToGain(evaluateEnvelope(outgoing, asTicks(TIMESCALE)))).toBe(0);

    expect(dbToGain(evaluateEnvelope(incoming, start))).toBe(0);
    expect(dbToGain(evaluateEnvelope(incoming, asTicks(TIMESCALE)))).toBeCloseTo(1, 9);
  });
});
