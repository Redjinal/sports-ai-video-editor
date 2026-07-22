import { describe, it, expect } from "vitest";
import { asTicks, TIMESCALE } from "./ticks";
import type { Sequence, SourceClip, Marker } from "./model";
import {
  applyCommand,
  type SetTrackFlagCommand,
  type AddMarkerCommand,
  type MoveMarkerCommand,
  type RemoveMarkerCommand,
  type MoveObjectCommand,
  type CommandMeta,
} from "./commands";
import { buildLinkedShift, buildLinkedSplit, linkGroupMembers } from "./operations";

const S = TIMESCALE;

function meta(id: string): CommandMeta {
  return { id, version: 1, sequenceId: "seq_1", timestamp: "2026-07-22T00:00:00Z" };
}

function linkedClip(
  id: string,
  trackId: string,
  start: number,
  duration: number,
  linkGroupId?: string,
): SourceClip {
  const base: SourceClip = {
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
  return linkGroupId ? { ...base, linkGroupId } : base;
}

function seqOf(objects: SourceClip[], markers: Marker[] = []): Sequence {
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
      {
        id: "trk_a1",
        name: "A1",
        type: "audio",
        order: 1,
        height: 48,
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

describe("track flags", () => {
  it("locks a track and inverts back to the prior value", () => {
    const start = seqOf([]);
    const lock: SetTrackFlagCommand = {
      type: "SetTrackFlag",
      meta: meta("lk"),
      trackId: "trk_v1",
      flag: "locked",
      value: true,
    };
    const { sequence, inverse } = applyCommand(start, lock);
    expect(sequence.tracks.find((t) => t.id === "trk_v1")!.locked).toBe(true);
    expect(applyCommand(sequence, inverse).sequence).toEqual(start);
  });

  it("a locked track blocks edits to its objects", () => {
    let seq = seqOf([linkedClip("a", "trk_v1", 0, S * 2)]);
    seq = applyCommand(seq, {
      type: "SetTrackFlag",
      meta: meta("lk"),
      trackId: "trk_v1",
      flag: "locked",
      value: true,
    }).sequence;
    const move: MoveObjectCommand = {
      type: "MoveObject",
      meta: meta("mv"),
      objectId: "a",
      toTrackId: "trk_v1",
      toStartTicks: asTicks(S),
    };
    expect(() => applyCommand(seq, move)).toThrowError(/locked/);
  });
});

describe("markers", () => {
  it("adds, moves, and removes a marker, each reversibly", () => {
    const start = seqOf([]);
    const marker: Marker = { id: "m1", atTicks: asTicks(S * 2), label: "Cut" };

    const add: AddMarkerCommand = { type: "AddMarker", meta: meta("am"), marker };
    const afterAdd = applyCommand(start, add);
    expect(afterAdd.sequence.markers).toHaveLength(1);
    expect(applyCommand(afterAdd.sequence, afterAdd.inverse).sequence).toEqual(start);

    const move: MoveMarkerCommand = {
      type: "MoveMarker",
      meta: meta("mm"),
      markerId: "m1",
      toTicks: asTicks(S * 5),
    };
    const afterMove = applyCommand(afterAdd.sequence, move);
    expect(afterMove.sequence.markers[0]!.atTicks).toBe(S * 5);
    expect(applyCommand(afterMove.sequence, afterMove.inverse).sequence).toEqual(afterAdd.sequence);
  });

  it("rejects a duplicate marker id and a move of an unknown marker", () => {
    const seq = seqOf([], [{ id: "m1", atTicks: asTicks(0), label: "A" }]);
    const dup: AddMarkerCommand = {
      type: "AddMarker",
      meta: meta("am"),
      marker: { id: "m1", atTicks: asTicks(S), label: "B" },
    };
    expect(() => applyCommand(seq, dup)).toThrowError(/already exists/);
    const badMove: RemoveMarkerCommand = {
      type: "RemoveMarker",
      meta: meta("rm"),
      markerId: "nope",
    };
    expect(() => applyCommand(seq, badMove)).toThrowError(/not found/);
  });
});

describe("linked video/audio", () => {
  const seq = seqOf([
    linkedClip("v", "trk_v1", 0, S * 4, "grp1"),
    linkedClip("a", "trk_a1", 0, S * 4, "grp1"),
    linkedClip("solo", "trk_v1", S * 6, S * 2),
  ]);

  it("resolves a link group and treats an unlinked clip as a singleton", () => {
    expect(linkGroupMembers(seq, "v").sort()).toEqual(["a", "v"]);
    expect(linkGroupMembers(seq, "solo")).toEqual(["solo"]);
  });

  it("shifts a linked pair together and undoes exactly", () => {
    const cmd = buildLinkedShift(seq, { objectId: "v", deltaTicks: S }, meta("ls"));
    const { sequence: out, inverse } = applyCommand(seq, cmd);
    expect(out.objects.find((o) => o.id === "v")!.startTicks).toBe(S);
    expect(out.objects.find((o) => o.id === "a")!.startTicks).toBe(S);
    expect(out.objects.find((o) => o.id === "solo")!.startTicks).toBe(S * 6); // unaffected
    expect(applyCommand(out, inverse).sequence).toEqual(seq);
  });

  it("splits both linked members at the same point and undoes exactly", () => {
    const cmd = buildLinkedSplit(
      seq,
      { objectId: "v", atTicks: asTicks(S * 2), newIdFor: (id) => `${id}_r` },
      meta("lsp"),
    );
    const { sequence: out, inverse } = applyCommand(seq, cmd);
    expect(out.objects.some((o) => o.id === "v_r")).toBe(true);
    expect(out.objects.some((o) => o.id === "a_r")).toBe(true);
    // Round-trip (id-sorted, since split appends new objects).
    const norm = (s: Sequence) => ({
      ...s,
      objects: [...s.objects].sort((x, y) => x.id.localeCompare(y.id)),
    });
    expect(norm(applyCommand(out, inverse).sequence)).toEqual(norm(seq));
  });
});
