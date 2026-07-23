import { describe, expect, it } from "vitest";
import { TIMESCALE, asTicks } from "@sve/timeline-domain";
import {
  msToTicks,
  parseSrtTimecode,
  parseVttTimecode,
  serializeSrtTimecode,
  serializeVttTimecode,
  ticksToMs,
  TICKS_PER_MS,
} from "./timecode";

describe("timecode <-> ticks", () => {
  it("has an exact integer ticks-per-millisecond", () => {
    expect(TICKS_PER_MS).toBe(27_000);
    expect(Number.isInteger(TICKS_PER_MS)).toBe(true);
  });

  it("converts 00:00:01,500 (SRT) to exactly 1.5s of ticks", () => {
    const ticks = parseSrtTimecode("00:00:01,500");
    expect(ticks).toBe(asTicks(Math.round(1.5 * TIMESCALE)));
  });

  it("converts 00:00:01.500 (VTT) to exactly 1.5s of ticks", () => {
    const ticks = parseVttTimecode("00:00:01.500");
    expect(ticks).toBe(asTicks(Math.round(1.5 * TIMESCALE)));
  });

  it("SRT and VTT timecodes for the same instant produce identical ticks", () => {
    expect(parseSrtTimecode("01:02:03,456")).toBe(parseVttTimecode("01:02:03.456"));
  });

  it("round-trips ms -> ticks -> ms exactly", () => {
    for (const ms of [0, 1, 999, 1000, 1500, 3_723_456]) {
      expect(ticksToMs(msToTicks(ms))).toBe(ms);
    }
  });

  it("serializes ticks back to the same timecode text", () => {
    expect(serializeSrtTimecode(parseSrtTimecode("00:00:01,500"))).toBe("00:00:01,500");
    expect(serializeSrtTimecode(parseSrtTimecode("01:23:45,006"))).toBe("01:23:45,006");
    expect(serializeVttTimecode(parseVttTimecode("00:00:01.500"))).toBe("00:00:01.500");
  });

  it("VTT accepts an omitted hour component", () => {
    expect(parseVttTimecode("01:02.500")).toBe(parseVttTimecode("00:01:02.500"));
  });

  it("rejects malformed timecodes", () => {
    expect(() => parseSrtTimecode("1:2:3,4")).toThrow();
    expect(() => parseSrtTimecode("00:00:01.500")).toThrow(); // wrong separator for SRT
    expect(() => parseVttTimecode("not a timecode")).toThrow();
  });
});
