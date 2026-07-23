/** @vitest-environment node */
import { describe, it, expect } from "vitest";
import { TIMESCALE, FRAME_RATES } from "@sve/timeline-domain";
import { tickToPx, pxToTick, pxToTickDelta, snapToFrame } from "./geometry";

describe("timeline geometry", () => {
  it("maps ticks to pixels at a given pixels-per-second", () => {
    // 1 second = TIMESCALE ticks; at 40 px/s that is 40px.
    expect(tickToPx(TIMESCALE, 40)).toBe(40);
    expect(tickToPx(TIMESCALE * 2, 40)).toBe(80);
    expect(tickToPx(0, 40)).toBe(0);
  });

  it("round-trips px -> tick -> px", () => {
    const px = 123;
    const t = pxToTick(px, 40);
    expect(tickToPx(t, 40)).toBeCloseTo(px, 0);
  });

  it("clamps negative positions to zero but allows negative deltas", () => {
    expect(pxToTick(-50, 40)).toBe(0);
    expect(pxToTickDelta(-40, 40)).toBe(-TIMESCALE);
  });

  it("snaps to exact frame boundaries", () => {
    const per = TIMESCALE / 30; // 900,000 at 30fps
    // A value just past frame 3 snaps back to frame 3.
    expect(snapToFrame(per * 3 + 100, FRAME_RATES.fps30)).toBe(per * 3);
    // Just before frame 4 snaps up to frame 4.
    expect(snapToFrame(per * 4 - 100, FRAME_RATES.fps30)).toBe(per * 4);
  });
});
