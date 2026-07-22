import { describe, it, expect } from "vitest";
import { asTicks, TIMESCALE } from "./ticks";
import type { Sequence, SourceClip } from "./model";
import { resolveSnap } from "./snapping";

const S = TIMESCALE;

function clip(id: string, start: number, duration: number): SourceClip {
  return {
    kind: "clip",
    id,
    trackId: "trk_v1",
    startTicks: asTicks(start),
    durationTicks: asTicks(duration),
    enabled: true,
    assetId: "ast_1",
    sourceInTicks: asTicks(0),
    sourceDurationTicks: asTicks(duration),
    playbackRate: 1,
  };
}

function seqOf(objects: SourceClip[], markers: Sequence["markers"] = []): Sequence {
  return {
    id: "seq_1",
    name: "S",
    settings: {
      width: 1920,
      height: 1080,
      pixelAspectRatio: { numerator: 1, denominator: 1 },
      frameRate: { numerator: 30, denominator: 1 },
      audioSampleRate: 48_000,
      background: "#000000",
      timeDisplayMode: "timecode",
    },
    tracks: [
      {
        id: "trk_v1",
        name: "V1",
        type: "video",
        order: 0,
        height: 64,
        color: "#334155",
        locked: false,
        hidden: false,
        muted: false,
        solo: false,
        editTargeted: true,
      },
    ],
    objects,
    markers,
    parentSequenceIds: [],
  };
}

describe("snapping", () => {
  const seq = seqOf([clip("a", 0, S * 2), clip("b", S * 5, S * 2)]);

  it("snaps to the nearest clip edge within the threshold", () => {
    // 100 ticks before b's end (S*7) -> should snap to clip-end at S*7.
    const near = asTicks(S * 7 - 100);
    const result = resolveSnap(seq, near, { thresholdTicks: 1000 });
    expect(result).not.toBeNull();
    expect(result!.targetType).toBe("clip-end");
    expect(result!.targetId).toBe("b");
    expect(result!.snappedTime).toBe(S * 7);
    expect(result!.distance).toBe(100);
  });

  it("returns null when nothing is within the threshold", () => {
    const between = asTicks(S * 3 + 12345);
    expect(resolveSnap(seq, between, { thresholdTicks: 100 })).toBeNull();
  });

  it("snaps to the sequence start and to a marker", () => {
    const withMarker = seqOf(
      [clip("a", 0, S * 2)],
      [{ id: "m1", atTicks: asTicks(S * 4), label: "M" }],
    );
    expect(resolveSnap(withMarker, asTicks(50), { thresholdTicks: 100 })!.targetType).toBe(
      "sequence-start",
    );
    const m = resolveSnap(withMarker, asTicks(S * 4 - 30), { thresholdTicks: 100 });
    expect(m!.targetType).toBe("marker");
    expect(m!.targetId).toBe("m1");
  });

  it("honours the playhead and sequence-end targets", () => {
    const r = resolveSnap(seq, asTicks(S * 10 - 20), {
      thresholdTicks: 100,
      playheadTicks: asTicks(S * 10),
      categories: ["playhead"],
    });
    expect(r!.targetType).toBe("playhead");
  });

  it("ignores the object being dragged", () => {
    // Near a's start (0), but ignore a -> should not snap to a's edges.
    const r = resolveSnap(seq, asTicks(30), {
      thresholdTicks: 100,
      ignoreObjectIds: ["a"],
      categories: ["clip-start", "clip-end"],
    });
    expect(r).toBeNull();
  });

  it("can restrict snapping to a category", () => {
    const r = resolveSnap(seq, asTicks(S * 2 + 20), {
      thresholdTicks: 100,
      categories: ["marker"], // no markers -> no snap even though a clip edge is near
    });
    expect(r).toBeNull();
  });
});
