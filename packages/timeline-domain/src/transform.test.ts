import { describe, it, expect } from "vitest";
import { asTicks, TIMESCALE } from "./ticks";
import {
  defaultTransform,
  evaluateAnimatable,
  evaluateTransform,
  upsertKeyframe,
  removeKeyframe,
  isAnimated,
  kf,
} from "./transform";

const S = TIMESCALE;

describe("animatable evaluation", () => {
  it("returns a constant channel unchanged", () => {
    expect(evaluateAnimatable(42, 0)).toBe(42);
    expect(evaluateAnimatable(42, S * 10)).toBe(42);
  });

  it("holds before the first and after the last keyframe", () => {
    const ch = { keyframes: [kf(S, 10), kf(S * 3, 30)] };
    expect(evaluateAnimatable(ch, 0)).toBe(10); // before first
    expect(evaluateAnimatable(ch, S * 5)).toBe(30); // after last
  });

  it("interpolates linearly between keyframes", () => {
    const ch = { keyframes: [kf(0, 0), kf(S * 2, 100)] };
    expect(evaluateAnimatable(ch, S)).toBe(50); // halfway
    expect(evaluateAnimatable(ch, S / 2)).toBe(25);
  });

  it("holds a value when the leading keyframe is a hold", () => {
    const ch = { keyframes: [kf(0, 0, "hold"), kf(S * 2, 100)] };
    expect(evaluateAnimatable(ch, S)).toBe(0); // stays until the next keyframe
  });

  it("eases with an S-curve (slower at the ends)", () => {
    const ch = { keyframes: [kf(0, 0, "ease"), kf(S * 2, 100)] };
    const mid = evaluateAnimatable(ch, S);
    expect(mid).toBeCloseTo(50, 5); // symmetric ease passes through the midpoint
    const quarter = evaluateAnimatable(ch, S / 2);
    expect(quarter).toBeLessThan(25); // eased-in is behind linear early on
  });
});

describe("transform evaluation", () => {
  it("evaluates every channel of a transform at a tick", () => {
    const t = {
      ...defaultTransform(),
      x: { keyframes: [kf(0, 0), kf(S * 2, 200)] },
      opacity: { keyframes: [kf(0, 0), kf(S * 2, 100)] },
    };
    const at = evaluateTransform(t, S);
    expect(at.x).toBe(100);
    expect(at.opacity).toBe(50);
    expect(at.scale).toBe(100); // constant default
  });
});

describe("keyframe editing", () => {
  it("upserts and sorts keyframes, and replaces one at the same time", () => {
    let ch = upsertKeyframe(0, kf(S * 2, 50));
    ch = upsertKeyframe(ch, kf(0, 0));
    ch = upsertKeyframe(ch, kf(S, 20));
    expect(typeof ch === "object" && ch.keyframes.map((k) => k.atTicks)).toEqual([0, S, S * 2]);
    // Replace the one at S with a new value.
    ch = upsertKeyframe(ch, kf(S, 99));
    expect(evaluateAnimatable(ch, S)).toBe(99);
    expect(isAnimated(ch)).toBe(true);
  });

  it("collapses back to a constant when only one keyframe remains", () => {
    const ch = { keyframes: [kf(0, 10), kf(S, 20)] };
    const one = removeKeyframe(ch, asTicks(S));
    expect(one).toBe(10); // constant again
    expect(isAnimated(one)).toBe(false);
  });
});
