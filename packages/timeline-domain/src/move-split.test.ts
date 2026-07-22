import { describe, it, expect } from "vitest";
import { asTicks, TIMESCALE } from "./ticks";
import type { Sequence, SourceClip } from "./model";
import {
  applyCommand,
  type MoveObjectCommand,
  type SplitObjectCommand,
  type BatchCommand,
  type CommandMeta,
} from "./commands";

function meta(id: string): CommandMeta {
  return { id, version: 1, sequenceId: "seq_1", timestamp: "2026-07-22T00:00:00Z" };
}

function track(id: string, order: number, locked = false) {
  return {
    id,
    name: id,
    type: "video" as const,
    order,
    height: 64,
    color: "#334155",
    locked,
    hidden: false,
    muted: false,
    solo: false,
    editTargeted: true,
  };
}

function clip(id: string, trackId: string, start: number, duration: number): SourceClip {
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

function sequence(
  objects: SourceClip[],
  tracks = [track("trk_v1", 0), track("trk_v2", 1)],
): Sequence {
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
    tracks,
    objects,
    markers: [],
    parentSequenceIds: [],
  };
}

const S = TIMESCALE;

describe("MoveObject", () => {
  it("moves a clip to a new track and start, with an exact inverse", () => {
    const start = sequence([clip("a", "trk_v1", 0, S * 2)]);
    const move: MoveObjectCommand = {
      type: "MoveObject",
      meta: meta("m"),
      objectId: "a",
      toTrackId: "trk_v2",
      toStartTicks: asTicks(S * 5),
    };
    const { sequence: moved, inverse } = applyCommand(start, move);
    const a = moved.objects[0]!;
    expect(a.trackId).toBe("trk_v2");
    expect(a.startTicks).toBe(S * 5);
    expect(applyCommand(moved, inverse).sequence).toEqual(start);
  });

  it("refuses to move onto an overlapping neighbour", () => {
    const start = sequence([clip("a", "trk_v1", 0, S * 2), clip("b", "trk_v2", S * 4, S * 2)]);
    // Move a into b's span on trk_v2.
    const move: MoveObjectCommand = {
      type: "MoveObject",
      meta: meta("m"),
      objectId: "a",
      toTrackId: "trk_v2",
      toStartTicks: asTicks(S * 5),
    };
    expect(() => applyCommand(start, move)).toThrowError(/overlap/);
  });

  it("allows a move that abuts a neighbour exactly (half-open intervals)", () => {
    const start = sequence([clip("a", "trk_v1", 0, S * 2), clip("b", "trk_v1", S * 4, S * 2)]);
    // a occupies [0,2); place it ending exactly at b's start 4 -> [2,4), touching but not overlapping.
    const move: MoveObjectCommand = {
      type: "MoveObject",
      meta: meta("m"),
      objectId: "a",
      toTrackId: "trk_v1",
      toStartTicks: asTicks(S * 2),
    };
    expect(() => applyCommand(start, move)).not.toThrow();
  });

  it("refuses to move off or onto a locked track", () => {
    const start = sequence(
      [clip("a", "trk_v1", 0, S * 2)],
      [track("trk_v1", 0), track("trk_locked", 1, true)],
    );
    const onto: MoveObjectCommand = {
      type: "MoveObject",
      meta: meta("m"),
      objectId: "a",
      toTrackId: "trk_locked",
      toStartTicks: asTicks(0),
    };
    expect(() => applyCommand(start, onto)).toThrowError(/locked/);
  });
});

describe("SplitObject", () => {
  it("splits a clip into two continuous halves", () => {
    const start = sequence([clip("a", "trk_v1", 0, S * 4)]);
    const split: SplitObjectCommand = {
      type: "SplitObject",
      meta: meta("s"),
      objectId: "a",
      atTicks: asTicks(S * 3),
      newObjectId: "b",
    };
    const { sequence: out } = applyCommand(start, split);
    const a = out.objects.find((o) => o.id === "a")!;
    const b = out.objects.find((o) => o.id === "b")!;
    expect(a.startTicks).toBe(0);
    expect(a.durationTicks).toBe(S * 3);
    expect(b.startTicks).toBe(S * 3);
    expect(b.durationTicks).toBe(S * 1);
    // Source is continuous: b resumes exactly where a's source ends.
    expect(b.sourceInTicks).toBe(a.sourceInTicks + a.sourceDurationTicks);
    expect(a.sourceDurationTicks + b.sourceDurationTicks).toBe(S * 4);
  });

  it("undo of a split restores the original single clip exactly", () => {
    const start = sequence([clip("a", "trk_v1", 0, S * 4)]);
    const split: SplitObjectCommand = {
      type: "SplitObject",
      meta: meta("s"),
      objectId: "a",
      atTicks: asTicks(S * 3),
      newObjectId: "b",
    };
    const { sequence: out, inverse } = applyCommand(start, split);
    const restored = applyCommand(out, inverse).sequence;
    expect(restored).toEqual(start);
  });

  it("rejects a split point on or outside the object edges", () => {
    const start = sequence([clip("a", "trk_v1", S * 2, S * 2)]); // [2,4)
    for (const at of [S * 2, S * 4, S * 1, S * 9]) {
      const split: SplitObjectCommand = {
        type: "SplitObject",
        meta: meta("s"),
        objectId: "a",
        atTicks: asTicks(at),
        newObjectId: "b",
      };
      expect(() => applyCommand(start, split)).toThrowError(/strictly inside/);
    }
  });
});

describe("Batch", () => {
  it("applies all sub-commands atomically and inverts as a reversed batch", () => {
    const start = sequence([clip("a", "trk_v1", 0, S * 2)]);
    const batch: BatchCommand = {
      type: "Batch",
      meta: meta("bulk"),
      commands: [
        {
          type: "MoveObject",
          meta: meta("m1"),
          objectId: "a",
          toTrackId: "trk_v2",
          toStartTicks: asTicks(S * 5),
        },
        { type: "AddObject", meta: meta("add"), object: clip("c", "trk_v1", 0, S) },
      ],
    };
    const { sequence: out, inverse } = applyCommand(start, batch);
    expect(out.objects).toHaveLength(2);
    expect(out.objects.find((o) => o.id === "a")!.trackId).toBe("trk_v2");
    expect(applyCommand(out, inverse).sequence).toEqual(start);
  });

  it("commits nothing when any sub-command fails", () => {
    const start = sequence([clip("a", "trk_v1", 0, S * 2), clip("b", "trk_v2", S * 4, S * 2)]);
    const batch: BatchCommand = {
      type: "Batch",
      meta: meta("bulk"),
      commands: [
        // valid move...
        {
          type: "MoveObject",
          meta: meta("m1"),
          objectId: "a",
          toTrackId: "trk_v1",
          toStartTicks: asTicks(S * 8),
        },
        // ...then an invalid one (collision) — the whole batch must roll back.
        {
          type: "MoveObject",
          meta: meta("m2"),
          objectId: "a",
          toTrackId: "trk_v2",
          toStartTicks: asTicks(S * 5),
        },
      ],
    };
    const frozen = JSON.stringify(start);
    expect(() => applyCommand(start, batch)).toThrow();
    expect(JSON.stringify(start)).toBe(frozen); // input untouched, nothing partially applied
  });
});
