import { describe, it, expect } from "vitest";
import { formatGameClock, formatShotClock, formatPeriodLabel } from "./clock-format";

describe("formatGameClock", () => {
  it("formats at/above one minute as M:SS", () => {
    expect(formatGameClock(65_000)).toBe("1:05");
    expect(formatGameClock(60_000)).toBe("1:00");
    expect(formatGameClock(600_000)).toBe("10:00");
  });

  it("formats under one minute as SS.s", () => {
    expect(formatGameClock(9_500)).toBe("9.5");
    expect(formatGameClock(500)).toBe("0.5");
    expect(formatGameClock(0)).toBe("0.0");
  });

  it("clamps negative input to zero", () => {
    expect(formatGameClock(-100)).toBe("0.0");
  });
});

describe("formatShotClock", () => {
  it("rounds up to whole seconds so the display never undercounts", () => {
    expect(formatShotClock(24_000)).toBe("24");
    expect(formatShotClock(23_001)).toBe("24");
    expect(formatShotClock(14_700)).toBe("15");
    expect(formatShotClock(1)).toBe("1");
    expect(formatShotClock(0)).toBe("0");
  });

  it("clamps negative input to zero", () => {
    expect(formatShotClock(-500)).toBe("0");
  });
});

describe("formatPeriodLabel", () => {
  it("labels regulation quarters", () => {
    expect(formatPeriodLabel(1)).toBe("1st");
    expect(formatPeriodLabel(2)).toBe("2nd");
    expect(formatPeriodLabel(3)).toBe("3rd");
    expect(formatPeriodLabel(4)).toBe("4th");
  });

  it("labels overtime periods", () => {
    expect(formatPeriodLabel(5)).toBe("OT");
    expect(formatPeriodLabel(6)).toBe("2OT");
    expect(formatPeriodLabel(7)).toBe("3OT");
  });

  it("rejects non-positive or non-integer periods", () => {
    expect(() => formatPeriodLabel(0)).toThrow(RangeError);
    expect(() => formatPeriodLabel(-1)).toThrow(RangeError);
    expect(() => formatPeriodLabel(1.5)).toThrow(RangeError);
  });
});
