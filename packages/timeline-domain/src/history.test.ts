import { describe, it, expect } from "vitest";
import { asTicks, TIMESCALE } from "./ticks";
import type { Sequence, SourceClip } from "./model";
import type { AddObjectCommand, TrimObjectCommand, CommandMeta } from "./commands";
import { createHistory, execute, undo, redo, canUndo, canRedo, undoLabel } from "./history";

const S = TIMESCALE;

function meta(id: string, label?: string): CommandMeta {
  return label
    ? { id, version: 1, sequenceId: "seq_1", timestamp: "2026-07-22T00:00:00Z", label }
    : { id, version: 1, sequenceId: "seq_1", timestamp: "2026-07-22T00:00:00Z" };
}

function emptySeq(): Sequence {
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
    objects: [],
    markers: [],
    parentSequenceIds: [],
  };
}

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

function add(id: string, obj: SourceClip, label?: string): AddObjectCommand {
  return { type: "AddObject", meta: meta(id, label), object: obj };
}

describe("command history", () => {
  it("executes commands and undoes them in reverse", () => {
    let h = createHistory(emptySeq());
    h = execute(h, add("c1", clip("a", 0, S)));
    h = execute(h, add("c2", clip("b", S * 2, S)));
    expect(h.sequence.objects).toHaveLength(2);

    h = undo(h);
    expect(h.sequence.objects.map((o) => o.id)).toEqual(["a"]);
    h = undo(h);
    expect(h.sequence.objects).toHaveLength(0);
    expect(canUndo(h)).toBe(false);
  });

  it("redoes undone commands", () => {
    let h = createHistory(emptySeq());
    h = execute(h, add("c1", clip("a", 0, S)));
    h = undo(h);
    expect(canRedo(h)).toBe(true);
    h = redo(h);
    expect(h.sequence.objects.map((o) => o.id)).toEqual(["a"]);
    expect(canRedo(h)).toBe(false);
  });

  it("round-trips a full undo back to the exact starting sequence", () => {
    const start = emptySeq();
    let h = createHistory(start);
    h = execute(h, add("c1", clip("a", 0, S)));
    const trim: TrimObjectCommand = {
      type: "TrimObject",
      meta: meta("c2"),
      objectId: "a",
      edge: "end",
      deltaTicks: -(S / 2),
    };
    h = execute(h, trim);
    h = undo(undo(h));
    expect(h.sequence).toEqual(start);
  });

  it("clears the redo stack when a new command is executed after undo", () => {
    let h = createHistory(emptySeq());
    h = execute(h, add("c1", clip("a", 0, S)));
    h = execute(h, add("c2", clip("b", S * 2, S)));
    h = undo(h); // b undone, now redoable
    expect(canRedo(h)).toBe(true);
    h = execute(h, add("c3", clip("c", S * 4, S))); // new branch
    expect(canRedo(h)).toBe(false);
    expect(h.sequence.objects.map((o) => o.id)).toEqual(["a", "c"]);
  });

  it("a failed command does not enter history", () => {
    let h = createHistory(emptySeq());
    h = execute(h, add("c1", clip("a", 0, S)));
    const before = h;
    // Duplicate id -> applyCommand throws.
    expect(() => execute(h, add("c2", clip("a", S * 2, S)))).toThrow();
    // The prior history value is intact and still usable.
    expect(h).toBe(before);
    expect(h.past).toHaveLength(1);
  });

  it("undo/redo on empty stacks are no-ops", () => {
    const h = createHistory(emptySeq());
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });

  it("exposes the label of the next undo", () => {
    let h = createHistory(emptySeq());
    h = execute(h, add("c1", clip("a", 0, S), "Add clip"));
    expect(undoLabel(h)).toBe("Add clip");
  });
});
