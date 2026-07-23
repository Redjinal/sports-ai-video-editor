// DEC-EDIT-007: transitions are separate timeline objects, not clip properties.
//
// Drives a two-clip sequence, drops a crossDissolve over the cut and a fade-out at the tail
// through the command history, then verifies: correct kind/spec, save/reopen round-trip,
// SetTransition + undo, and remove/undo — the timeline-change exit gate for this slice.
import { describe, it, expect } from "vitest";
import { asTicks, TIMESCALE } from "./ticks";
import type { Sequence, SourceClip, TransitionObject } from "./model";
import { buildCrossDissolve, type CommandMeta } from "./commands";
import { createHistory, execute, undo } from "./history";
import { parseSequence, serializeSequence } from "./serialization";

const S = TIMESCALE;
let seq = 0;
function meta(): CommandMeta {
  seq += 1;
  return {
    id: `cmd_${seq}`,
    version: 1,
    sequenceId: "seq_master",
    timestamp: "2026-07-22T00:00:00Z",
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

function twoClipSequence(): Sequence {
  return {
    id: "seq_master",
    name: "Master",
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
        id: "V1",
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
    objects: [clip("v1", "V1", 0, S * 4), clip("v2", "V1", S * 4, S * 4)],
    markers: [],
    parentSequenceIds: [],
  };
}

function norm(s: Sequence): Sequence {
  return { ...s, objects: [...s.objects].sort((a, b) => a.id.localeCompare(b.id)) };
}

describe("separate transition objects (DEC-EDIT-007)", () => {
  it("lands a crossDissolve and a fade with correct kind and spec", () => {
    let h = createHistory(twoClipSequence());

    // Cross-dissolve straddling the cut at S*4, one second wide.
    h = execute(
      h,
      buildCrossDissolve(h.sequence, {
        id: "t1",
        fromId: "v1",
        toId: "v2",
        durationTicks: asTicks(S),
        meta: meta(),
      }),
    );
    // Fade-out to black over the tail of the second clip.
    const fade: TransitionObject = {
      kind: "transition",
      id: "t2",
      trackId: "V1",
      startTicks: asTicks(S * 7),
      durationTicks: asTicks(S),
      enabled: true,
      sourceInTicks: asTicks(0),
      sourceDurationTicks: asTicks(S),
      playbackRate: 1,
      transition: { type: "fade", color: "#000000", direction: "out" },
      fromId: "v2",
    };
    h = execute(h, { type: "AddObject", meta: meta(), object: fade });

    const dissolve = h.sequence.objects.find((o) => o.id === "t1") as TransitionObject;
    expect(dissolve.kind).toBe("transition");
    expect(dissolve.transition).toEqual({ type: "crossDissolve" });
    // Centred on the cut: starts half a duration before the boundary and spans it.
    expect(dissolve.startTicks).toBe(S * 4 - S / 2);
    expect(dissolve.fromId).toBe("v1");
    expect(dissolve.toId).toBe("v2");

    const fadeObj = h.sequence.objects.find((o) => o.id === "t2") as TransitionObject;
    expect(fadeObj.transition).toEqual({ type: "fade", color: "#000000", direction: "out" });
    expect(fadeObj.toId).toBeUndefined();
  });

  it("survives save/reopen unchanged (round-trip)", () => {
    let h = createHistory(twoClipSequence());
    h = execute(
      h,
      buildCrossDissolve(h.sequence, {
        id: "t1",
        fromId: "v1",
        toId: "v2",
        durationTicks: asTicks(S),
        meta: meta(),
      }),
    );
    h = execute(h, {
      type: "AddObject",
      meta: meta(),
      object: {
        kind: "transition",
        id: "t2",
        trackId: "V1",
        startTicks: asTicks(0),
        durationTicks: asTicks(S),
        enabled: true,
        sourceInTicks: asTicks(0),
        sourceDurationTicks: asTicks(S),
        playbackRate: 1,
        transition: { type: "wipe", angleDegrees: 45, softnessPx: 8 },
      },
    });

    const reopened = parseSequence(serializeSequence(h.sequence));
    expect(norm(reopened)).toEqual(norm(h.sequence));
  });

  it("SetTransition changes the spec and undo restores it", () => {
    let h = createHistory(twoClipSequence());
    h = execute(
      h,
      buildCrossDissolve(h.sequence, {
        id: "t1",
        fromId: "v1",
        toId: "v2",
        durationTicks: asTicks(S),
        meta: meta(),
      }),
    );

    h = execute(h, {
      type: "SetTransition",
      meta: meta(),
      objectId: "t1",
      transition: { type: "dip", color: "#ffffff" },
    });
    expect((h.sequence.objects.find((o) => o.id === "t1") as TransitionObject).transition).toEqual({
      type: "dip",
      color: "#ffffff",
    });

    h = undo(h);
    expect((h.sequence.objects.find((o) => o.id === "t1") as TransitionObject).transition).toEqual({
      type: "crossDissolve",
    });
  });

  it("rejects SetTransition on a non-transition object", () => {
    const h = createHistory(twoClipSequence());
    expect(() =>
      execute(h, {
        type: "SetTransition",
        meta: meta(),
        objectId: "v1",
        transition: { type: "crossDissolve" },
      }),
    ).toThrowError(/not a transition/);
  });

  it("removing a transition and undoing returns to the prior state", () => {
    let h = createHistory(twoClipSequence());
    h = execute(
      h,
      buildCrossDissolve(h.sequence, {
        id: "t1",
        fromId: "v1",
        toId: "v2",
        durationTicks: asTicks(S),
        meta: meta(),
      }),
    );
    const withTransition = h.sequence;

    h = execute(h, { type: "RemoveObject", meta: meta(), objectId: "t1" });
    expect(h.sequence.objects.some((o) => o.id === "t1")).toBe(false);

    h = undo(h);
    expect(norm(h.sequence)).toEqual(norm(withTransition));
  });
});
