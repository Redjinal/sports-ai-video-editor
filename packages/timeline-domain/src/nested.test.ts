import { describe, it, expect } from "vitest";
import { asTicks, TIMESCALE } from "./ticks";
import type { Sequence, NestedSequenceObject, SourceClip } from "./model";
import {
  applyCommand,
  type AddObjectCommand,
  type SplitObjectCommand,
  type CommandMeta,
} from "./commands";
import { wouldCreateCycle } from "./operations";
import { parseSequence, serializeSequence } from "./serialization";

const S = TIMESCALE;

function meta(id: string): CommandMeta {
  return { id, version: 1, sequenceId: "seq_host", timestamp: "2026-07-22T00:00:00Z" };
}

function nested(
  id: string,
  sequenceId: string,
  start: number,
  duration: number,
): NestedSequenceObject {
  return {
    kind: "nested",
    id,
    trackId: "trk_v1",
    startTicks: asTicks(start),
    durationTicks: asTicks(duration),
    enabled: true,
    sequenceId,
    sourceInTicks: asTicks(0),
    sourceDurationTicks: asTicks(duration),
    playbackRate: 1,
  };
}

function hostSeq(objects: (SourceClip | NestedSequenceObject)[] = []): Sequence {
  return {
    id: "seq_host",
    name: "Host",
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

describe("nested sequence objects", () => {
  it("adds a nested-sequence instance and inverts it", () => {
    const start = hostSeq();
    const add: AddObjectCommand = {
      type: "AddObject",
      meta: meta("add"),
      object: nested("n1", "seq_child", 0, S * 3),
    };
    const { sequence, inverse } = applyCommand(start, add);
    expect(sequence.objects[0]!.kind).toBe("nested");
    expect((sequence.objects[0] as NestedSequenceObject).sequenceId).toBe("seq_child");
    expect(applyCommand(sequence, inverse).sequence).toEqual(start);
  });

  it("splits a nested instance like any ranged object, and undoes exactly", () => {
    const start = hostSeq([nested("n1", "seq_child", 0, S * 4)]);
    const split: SplitObjectCommand = {
      type: "SplitObject",
      meta: meta("s"),
      objectId: "n1",
      atTicks: asTicks(S * 3),
      newObjectId: "n1b",
    };
    const { sequence, inverse } = applyCommand(start, split);
    const right = sequence.objects.find((o) => o.id === "n1b")!;
    expect(right.kind).toBe("nested");
    expect((right as NestedSequenceObject).sequenceId).toBe("seq_child"); // reference preserved
    expect(right.startTicks).toBe(S * 3);
    expect(applyCommand(sequence, inverse).sequence).toEqual(start);
  });

  it("survives serialize/parse as a discriminated union", () => {
    const seq = hostSeq([
      nested("n1", "seq_child", 0, S * 2),
      {
        kind: "clip",
        id: "c1",
        trackId: "trk_v1",
        startTicks: asTicks(S * 2),
        durationTicks: asTicks(S),
        enabled: true,
        assetId: "ast_1",
        sourceInTicks: asTicks(0),
        sourceDurationTicks: asTicks(S),
        playbackRate: 1,
      },
    ]);
    const restored = parseSequence(serializeSequence(seq));
    expect(restored).toEqual(seq);
    expect(restored.objects.map((o) => o.kind)).toEqual(["nested", "clip"]);
  });
});

describe("circular-nesting prevention", () => {
  const child = hostSeq(); // seq_host renamed conceptually; build explicit graph below
  void child;

  function make(id: string, nestsIds: string[]): Sequence {
    return {
      ...hostSeq(nestsIds.map((sid, i) => nested(`n_${id}_${i}`, sid, 0, S))),
      id,
    };
  }

  it("flags a self-nest", () => {
    const map = new Map([["A", make("A", [])]]);
    expect(wouldCreateCycle(map, "A", "A")).toBe(true);
  });

  it("flags a transitive cycle (A nests B, B nests C; nesting A into C would loop)", () => {
    const A = make("A", ["B"]);
    const B = make("B", ["C"]);
    const C = make("C", []);
    const map = new Map([
      ["A", A],
      ["B", B],
      ["C", C],
    ]);
    // C is reachable from A (A->B->C). Adding A as a nested child of C closes the loop.
    expect(wouldCreateCycle(map, "C", "A")).toBe(true);
    // But nesting C into A is fine (no existing path C->A).
    expect(wouldCreateCycle(map, "A", "C")).toBe(false);
  });
});
