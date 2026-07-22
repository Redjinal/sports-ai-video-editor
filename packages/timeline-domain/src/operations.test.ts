import { describe, it, expect } from "vitest";
import { asTicks, TIMESCALE } from "./ticks";
import type { Sequence, SourceClip } from "./model";
import { applyCommand, type CommandMeta } from "./commands";
import { buildRippleTrimEnd, buildRippleDelete, buildInsert, buildOverwrite } from "./operations";

const S = TIMESCALE;

function meta(id: string): CommandMeta {
  return { id, version: 1, sequenceId: "seq_1", timestamp: "2026-07-22T00:00:00Z" };
}

function clip(id: string, start: number, duration: number, trackId = "trk_v1"): SourceClip {
  return {
    kind: "clip",
    id,
    trackId,
    startTicks: asTicks(start),
    durationTicks: asTicks(duration),
    enabled: true,
    assetId: "ast_1",
    sourceInTicks: asTicks(0),
    sourceDurationTicks: asTicks(duration),
    playbackRate: 1,
  };
}

function seqOf(objects: SourceClip[]): Sequence {
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
    markers: [],
    parentSequenceIds: [],
  };
}

/** Sorted [id, start, end] snapshot for readable assertions. */
function layout(seq: Sequence): Array<[string, number, number]> {
  return seq.objects
    .map((o): [string, number, number] => [o.id, o.startTicks, o.startTicks + o.durationTicks])
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
}

/**
 * Object array order is not authoritative — objects are a set keyed by id — so an operation
 * that removes and re-adds an object (overwrite's undo) may reorder the array while restoring
 * the same content. Compare by id-sorted objects.
 */
function normalize(seq: Sequence): Sequence {
  return { ...seq, objects: [...seq.objects].sort((a, b) => a.id.localeCompare(b.id)) };
}

describe("ripple trim (out point)", () => {
  it("shortening pulls later clips left; undo restores exactly", () => {
    // a[0,4) b[4,6) c[6,8)
    const start = seqOf([clip("a", 0, S * 4), clip("b", S * 4, S * 2), clip("c", S * 6, S * 2)]);
    const cmd = buildRippleTrimEnd(start, { objectId: "a", deltaTicks: -S }, meta("rt"));
    const { sequence: out, inverse } = applyCommand(start, cmd);
    expect(layout(out)).toEqual([
      ["a", 0, S * 3],
      ["b", S * 3, S * 5],
      ["c", S * 5, S * 7],
    ]);
    expect(applyCommand(out, inverse).sequence).toEqual(start);
  });

  it("extending pushes later clips right", () => {
    const start = seqOf([clip("a", 0, S * 2), clip("b", S * 2, S * 2)]);
    const cmd = buildRippleTrimEnd(start, { objectId: "a", deltaTicks: S }, meta("rt"));
    const { sequence: out } = applyCommand(start, cmd);
    expect(layout(out)).toEqual([
      ["a", 0, S * 3],
      ["b", S * 3, S * 5],
    ]);
  });
});

describe("ripple delete", () => {
  it("removes a clip and closes the gap; undo restores exactly", () => {
    const start = seqOf([clip("a", 0, S * 2), clip("b", S * 2, S * 2), clip("c", S * 4, S * 2)]);
    const cmd = buildRippleDelete(start, { objectId: "b" }, meta("rd"));
    const { sequence: out, inverse } = applyCommand(start, cmd);
    expect(layout(out)).toEqual([
      ["a", 0, S * 2],
      ["c", S * 2, S * 4],
    ]);
    expect(normalize(applyCommand(out, inverse).sequence)).toEqual(normalize(start));
  });
});

describe("insert", () => {
  it("makes space at the insert point and drops the clip in; undo restores exactly", () => {
    const start = seqOf([clip("a", 0, S * 2), clip("b", S * 2, S * 2)]);
    const inserted = clip("x", S * 2, S); // insert 1s at t=2
    const cmd = buildInsert(start, { object: inserted, targetTrackIds: ["trk_v1"] }, meta("ins"));
    const { sequence: out, inverse } = applyCommand(start, cmd);
    expect(layout(out)).toEqual([
      ["a", 0, S * 2],
      ["x", S * 2, S * 3],
      ["b", S * 3, S * 5],
    ]);
    expect(applyCommand(out, inverse).sequence).toEqual(start);
  });
});

describe("overwrite", () => {
  it("removes fully-covered clips and trims boundary clips; undo restores exactly", () => {
    // a[0,3) b[3,6) c[6,9); overwrite x[2,7)
    const start = seqOf([clip("a", 0, S * 3), clip("b", S * 3, S * 3), clip("c", S * 6, S * 3)]);
    const x = clip("x", S * 2, S * 5); // [2,7)
    const cmd = buildOverwrite(start, { object: x, targetTrackId: "trk_v1" }, meta("ow"));
    const { sequence: out, inverse } = applyCommand(start, cmd);
    // a trimmed to [0,2), b fully covered and removed, c trimmed to [7,9), x added [2,7)
    expect(layout(out)).toEqual([
      ["a", 0, S * 2],
      ["x", S * 2, S * 7],
      ["c", S * 7, S * 9],
    ]);
    expect(normalize(applyCommand(out, inverse).sequence)).toEqual(normalize(start));
  });

  it("splits a clip that spans the whole overwrite range; undo restores exactly", () => {
    // one long clip a[0,10); overwrite x[3,6)
    const start = seqOf([clip("a", 0, S * 10)]);
    const x = clip("x", S * 3, S * 3); // [3,6)
    const cmd = buildOverwrite(start, { object: x, targetTrackId: "trk_v1" }, meta("ow"));
    const { sequence: out, inverse } = applyCommand(start, cmd);
    // a keeps [0,3), its tail becomes [6,10), x fills [3,6)
    const spans = layout(out).map(([, s, e]) => [s, e]);
    expect(spans).toContainEqual([0, S * 3]);
    expect(spans).toContainEqual([S * 3, S * 6]);
    expect(spans).toContainEqual([S * 6, S * 10]);
    expect(normalize(applyCommand(out, inverse).sequence)).toEqual(normalize(start));
  });
});
