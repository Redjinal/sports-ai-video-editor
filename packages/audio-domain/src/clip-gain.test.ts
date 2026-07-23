import { describe, it, expect } from "vitest";
import { asTicks, TIMESCALE } from "@sve/timeline-domain";
import {
  createClipOverlay,
  findClipOverlay,
  clipOverlayGain,
  type ClipAudioOverlayMap,
} from "./clip-gain";
import { fadeIn } from "./envelope";
import { dbToGain } from "./gain";

describe("clip-level gain overlay", () => {
  it("no overlay -> unity gain", () => {
    expect(clipOverlayGain(undefined, asTicks(0))).toBe(1);
  });

  it("a static gain trim quiets a clip without touching the track", () => {
    const overlay = createClipOverlay({ objectId: "clp_1", gainDb: -6 });
    expect(clipOverlayGain(overlay, asTicks(0))).toBeCloseTo(dbToGain(-6), 9);
  });

  it("a clip-local fade envelope is honored", () => {
    const overlay = createClipOverlay({
      objectId: "clp_1",
      envelope: fadeIn(asTicks(0), asTicks(TIMESCALE)),
    });
    expect(clipOverlayGain(overlay, asTicks(0))).toBe(0);
    expect(clipOverlayGain(overlay, asTicks(TIMESCALE))).toBeCloseTo(1, 9);
  });

  it("static trim and envelope combine multiplicatively", () => {
    const overlay = createClipOverlay({
      objectId: "clp_1",
      gainDb: -6,
      envelope: fadeIn(asTicks(0), asTicks(TIMESCALE)),
    });
    const gain = clipOverlayGain(overlay, asTicks(TIMESCALE));
    expect(gain).toBeCloseTo(dbToGain(-6), 9);
  });

  it("omits optional keys entirely when not provided (exactOptionalPropertyTypes-safe)", () => {
    const overlay = createClipOverlay({ objectId: "clp_1" });
    expect("gainDb" in overlay).toBe(false);
    expect("envelope" in overlay).toBe(false);
  });

  it("findClipOverlay looks up by object id in a map", () => {
    const overlays: ClipAudioOverlayMap = {
      clp_1: createClipOverlay({ objectId: "clp_1", gainDb: -3 }),
    };
    expect(findClipOverlay(overlays, "clp_1")?.gainDb).toBe(-3);
    expect(findClipOverlay(overlays, "clp_missing")).toBeUndefined();
  });
});
