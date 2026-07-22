import { describe, it, expect } from "vitest";
import { asTicks, TIMESCALE, type Ticks } from "./ticks";
import type { Sequence, SourceClip } from "./model";
import {
  applyCommand,
  type AddObjectCommand,
  type TrimObjectCommand,
  type CommandMeta,
} from "./commands";

const SEQ_ID = "seq_1";
const ASSET_BOUNDS = new Map<string, Ticks>([["ast_1", asTicks(TIMESCALE * 20)]]);

function meta(id: string): CommandMeta {
  return { id, version: 1, sequenceId: SEQ_ID, timestamp: "2026-07-22T00:00:00Z" };
}

function baseSequence(): Sequence {
  return {
    id: SEQ_ID,
    name: "Slice",
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
    objects: [],
    markers: [],
    parentSequenceIds: [],
  };
}

function clip(): SourceClip {
  return {
    kind: "clip",
    id: "clp_1",
    trackId: "trk_v1",
    startTicks: asTicks(0),
    durationTicks: asTicks(TIMESCALE * 2), // 2s on the timeline
    enabled: true,
    assetId: "ast_1",
    sourceInTicks: asTicks(TIMESCALE * 3), // in-point 3s into the source
    sourceDurationTicks: asTicks(TIMESCALE * 2),
    playbackRate: 1,
  };
}

function addClip(): AddObjectCommand {
  return { type: "AddObject", meta: meta("cmd_add"), object: clip() };
}

describe("AddObject (place)", () => {
  it("places a clip and produces a RemoveObject inverse", () => {
    const { sequence, inverse } = applyCommand(baseSequence(), addClip(), {
      assetBounds: ASSET_BOUNDS,
    });
    expect(sequence.objects).toHaveLength(1);
    expect(inverse.type).toBe("RemoveObject");
  });

  it("undo restores the exact prior sequence", () => {
    const start = baseSequence();
    const { sequence, inverse } = applyCommand(start, addClip(), { assetBounds: ASSET_BOUNDS });
    const { sequence: undone } = applyCommand(sequence, inverse, { assetBounds: ASSET_BOUNDS });
    expect(undone).toEqual(start);
  });

  it("rejects a duplicate object id", () => {
    const once = applyCommand(baseSequence(), addClip(), { assetBounds: ASSET_BOUNDS }).sequence;
    expect(() => applyCommand(once, addClip(), { assetBounds: ASSET_BOUNDS })).toThrowError(
      /already exists/,
    );
  });

  it("rejects an unknown track", () => {
    const cmd: AddObjectCommand = {
      type: "AddObject",
      meta: meta("cmd_bad_track"),
      object: { ...clip(), trackId: "nope" },
    };
    expect(() => applyCommand(baseSequence(), cmd)).toThrowError(/Track nope not found/);
  });

  it("rejects a clip whose source range exceeds asset bounds", () => {
    const cmd: AddObjectCommand = {
      type: "AddObject",
      meta: meta("cmd_oob"),
      object: {
        ...clip(),
        sourceInTicks: asTicks(TIMESCALE * 19),
        sourceDurationTicks: asTicks(TIMESCALE * 2),
      },
    };
    expect(() => applyCommand(baseSequence(), cmd, { assetBounds: ASSET_BOUNDS })).toThrowError(
      /exceeds asset bounds/,
    );
  });

  it("does not mutate the input sequence and is deterministic", () => {
    const start = baseSequence();
    const frozen = JSON.stringify(start);
    const a = applyCommand(start, addClip(), { assetBounds: ASSET_BOUNDS }).sequence;
    const b = applyCommand(start, addClip(), { assetBounds: ASSET_BOUNDS }).sequence;
    expect(JSON.stringify(start)).toBe(frozen); // input untouched
    expect(a).toEqual(b); // same inputs -> same output
  });
});

describe("TrimObject (standard trim)", () => {
  function placed(): Sequence {
    return applyCommand(baseSequence(), addClip(), { assetBounds: ASSET_BOUNDS }).sequence;
  }

  it("trims the tail and undo restores exactly", () => {
    const start = placed();
    const trim: TrimObjectCommand = {
      type: "TrimObject",
      meta: meta("cmd_trim_end"),
      objectId: "clp_1",
      edge: "end",
      deltaTicks: -(TIMESCALE / 2), // shorten by 0.5s
    };
    const { sequence, inverse } = applyCommand(start, trim, { assetBounds: ASSET_BOUNDS });
    const trimmed = sequence.objects[0]!;
    expect(trimmed.durationTicks).toBe(TIMESCALE * 1.5);
    expect(trimmed.startTicks).toBe(0); // tail trim does not move start
    const { sequence: undone } = applyCommand(sequence, inverse, { assetBounds: ASSET_BOUNDS });
    expect(undone).toEqual(start);
  });

  it("trims the head, moving start and in-point together, and undo restores", () => {
    const start = placed();
    const delta = TIMESCALE / 2; // move head +0.5s
    const trim: TrimObjectCommand = {
      type: "TrimObject",
      meta: meta("cmd_trim_start"),
      objectId: "clp_1",
      edge: "start",
      deltaTicks: delta,
    };
    const { sequence, inverse } = applyCommand(start, trim, { assetBounds: ASSET_BOUNDS });
    const c = sequence.objects[0]!;
    expect(c.startTicks).toBe(delta);
    expect(c.durationTicks).toBe(TIMESCALE * 1.5);
    expect(c.sourceInTicks).toBe(TIMESCALE * 3 + delta);
    const { sequence: undone } = applyCommand(sequence, inverse, { assetBounds: ASSET_BOUNDS });
    expect(undone).toEqual(start);
  });

  it("refuses to trim a clip to zero duration", () => {
    const start = placed();
    const trim: TrimObjectCommand = {
      type: "TrimObject",
      meta: meta("cmd_trim_zero"),
      objectId: "clp_1",
      edge: "end",
      deltaTicks: -(TIMESCALE * 2),
    };
    expect(() => applyCommand(start, trim, { assetBounds: ASSET_BOUNDS })).toThrowError(/zero/);
  });

  it("refuses to extend past the available source", () => {
    const start = placed();
    // in-point is at 3s, bounds 20s; extend end by 18s -> source end 3+2+18=23s > 20s.
    const trim: TrimObjectCommand = {
      type: "TrimObject",
      meta: meta("cmd_trim_oob"),
      objectId: "clp_1",
      edge: "end",
      deltaTicks: TIMESCALE * 18,
    };
    expect(() => applyCommand(start, trim, { assetBounds: ASSET_BOUNDS })).toThrowError(
      /source bounds/,
    );
  });
});
