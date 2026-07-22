// M3 exit criteria (02-phase-roadmap.md §7):
// "A multi-track edit survives save/reopen and every required operation has deterministic
//  undo/redo."
//
// Drives a realistic multi-track editing session through the command history, saves and
// reopens mid-way, then undoes the whole session back to the exact starting state.
import { describe, it, expect } from "vitest";
import { asTicks, TIMESCALE } from "./ticks";
import type { Sequence, SourceClip } from "./model";
import { type CommandMeta } from "./commands";
import { createHistory, execute, undo, redo } from "./history";
import { buildRippleDelete, buildInsert } from "./operations";
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

function twoTrackSequence(): Sequence {
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
      {
        id: "A1",
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
    objects: [
      clip("v1", "V1", 0, S * 4),
      clip("v2", "V1", S * 4, S * 4),
      clip("a1", "A1", 0, S * 8),
    ],
    markers: [],
    parentSequenceIds: [],
  };
}

function norm(s: Sequence): Sequence {
  return { ...s, objects: [...s.objects].sort((a, b) => a.id.localeCompare(b.id)) };
}

describe("M3 exit criteria", () => {
  it("a multi-track edit survives save/reopen and undoes deterministically", () => {
    const start = twoTrackSequence();
    let h = createHistory(start);

    // A sequence of required operations across two tracks.
    h = execute(h, {
      type: "SplitObject",
      meta: meta(),
      objectId: "v1",
      atTicks: asTicks(S * 2),
      newObjectId: "v1b",
    });
    h = execute(h, {
      type: "MoveObject",
      meta: meta(),
      objectId: "v2",
      toTrackId: "V1",
      toStartTicks: asTicks(S * 10),
    });
    h = execute(
      h,
      buildInsert(
        h.sequence,
        { object: clip("v3", "V1", S * 6, S * 2), targetTrackIds: ["V1"] },
        meta(),
      ),
    );
    h = execute(h, {
      type: "AddMarker",
      meta: meta(),
      marker: { id: "m1", atTicks: asTicks(S * 3), label: "Highlight" },
    });
    h = execute(h, {
      type: "SetTrackFlag",
      meta: meta(),
      trackId: "A1",
      flag: "muted",
      value: true,
    });
    h = execute(h, buildRippleDelete(h.sequence, { objectId: "v1b" }, meta()));

    const edited = h.sequence;
    expect(edited.markers).toHaveLength(1);
    expect(edited.tracks.find((t) => t.id === "A1")!.muted).toBe(true);

    // SAVE + REOPEN: the edited sequence must round-trip through the portable schema unchanged.
    const reopened = parseSequence(serializeSequence(edited));
    expect(norm(reopened)).toEqual(norm(edited));

    // Continuing to edit after reopen still works (history is in-memory; state is intact).
    let h2 = createHistory(reopened);
    h2 = execute(h2, { type: "MoveMarker", meta: meta(), markerId: "m1", toTicks: asTicks(S * 5) });
    expect(h2.sequence.markers[0]!.atTicks).toBe(S * 5);
    h2 = undo(h2);
    expect(h2.sequence.markers[0]!.atTicks).toBe(S * 3);

    // DETERMINISTIC UNDO: unwind the entire original session back to the exact start.
    const steps = h.past.length;
    for (let i = 0; i < steps; i++) h = undo(h);
    expect(norm(h.sequence)).toEqual(norm(start));

    // REDO the whole session and confirm it matches the edited state.
    for (let i = 0; i < steps; i++) h = redo(h);
    expect(norm(h.sequence)).toEqual(norm(edited));
  });
});
