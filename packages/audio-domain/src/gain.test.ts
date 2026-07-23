import { describe, it, expect } from "vitest";
import { dbToGain, gainToDb } from "./gain";

describe("dB <-> linear gain", () => {
  it("0 dB is unity gain", () => {
    expect(dbToGain(0)).toBe(1);
    expect(gainToDb(1)).toBe(0);
  });

  it("-6 dB is approximately 0.501 linear gain", () => {
    expect(dbToGain(-6)).toBeCloseTo(0.501187, 5);
  });

  it("+6 dB is approximately 1.995 linear gain (boost)", () => {
    expect(dbToGain(6)).toBeCloseTo(1.995262, 5);
  });

  it("-Infinity dB is exactly 0 linear gain (silence)", () => {
    expect(dbToGain(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it("non-positive gain maps to -Infinity dB", () => {
    expect(gainToDb(0)).toBe(Number.NEGATIVE_INFINITY);
    expect(gainToDb(-1)).toBe(Number.NEGATIVE_INFINITY);
  });

  it("round-trips db -> gain -> db for a range of levels", () => {
    for (const db of [-24, -12, -6, -3, 0, 3, 6, 12]) {
      expect(gainToDb(dbToGain(db))).toBeCloseTo(db, 9);
    }
  });
});
