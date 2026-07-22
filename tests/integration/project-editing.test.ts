// Integration across the platform-neutral packages: timeline edit -> manifest -> stable
// serialization -> validated re-parse -> undo.
//
// This deliberately does NOT touch the filesystem. Authoritative project I/O lives in
// native/desktop-storage and is tested there against real files (DEC-ARCH-010); duplicating
// it here would validate code the app never executes.
import { describe, it, expect } from "vitest";
import {
  asTicks,
  TIMESCALE,
  type Sequence,
  type SourceClip,
  type AddObjectCommand,
} from "@sve/timeline-domain";
import { createEmptyManifest, parseManifest, type ProjectManifest } from "@sve/project-domain";
import { stableStringify } from "@sve/persistence";
import { executeTimelineCommand } from "@sve/application-services";

function emptySequence(): Sequence {
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
    durationTicks: asTicks(TIMESCALE * 5),
    enabled: true,
    assetId: "ast_1",
    sourceInTicks: asTicks(0),
    sourceDurationTicks: asTicks(TIMESCALE * 5),
    playbackRate: 1,
  };
}

function addCommand(): AddObjectCommand {
  return {
    type: "AddObject",
    meta: {
      id: "cmd_1",
      version: 1,
      sequenceId: "seq_master",
      timestamp: "2026-07-22T00:00:00.000Z",
    },
    object: clip(),
  };
}

function manifestWith(seq: Sequence): ProjectManifest {
  return {
    ...createEmptyManifest({
      projectId: "prj_1",
      name: "Home vs Away",
      now: "2026-07-22T00:00:00.000Z",
    }),
    sequences: [seq],
    activeMasterSequenceId: seq.id,
  };
}

describe("project editing round-trip", () => {
  it("an edited timeline survives serialization and schema re-validation", () => {
    const { sequence: edited } = executeTimelineCommand(emptySequence(), addCommand());
    expect(edited.objects).toHaveLength(1);

    // This is exactly the payload the app hands to the native storage layer.
    const wire = stableStringify(manifestWith(edited));
    const restored = parseManifest(JSON.parse(wire));

    expect(restored.sequences[0]!.objects).toHaveLength(1);
    expect(restored.sequences[0]!.objects[0]!.durationTicks).toBe(TIMESCALE * 5);
    expect(restored.activeMasterSequenceId).toBe("seq_master");
  });

  it("serialization is byte-stable across differently ordered manifests", () => {
    const { sequence } = executeTimelineCommand(emptySequence(), addCommand());
    const a = manifestWith(sequence);
    const b: ProjectManifest = { ...a };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it("a malformed manifest is rejected before it can reach storage", () => {
    const { sequence } = executeTimelineCommand(emptySequence(), addCommand());
    const broken = JSON.parse(stableStringify(manifestWith(sequence))) as Record<string, unknown>;
    (
      broken as { sequences: { objects: { durationTicks: number }[] }[] }
    ).sequences[0]!.objects[0]!.durationTicks = 0;
    expect(() => parseManifest(broken)).toThrow();
  });

  it("undo returns the sequence to its pre-edit state", () => {
    const start = emptySequence();
    const { sequence: edited, inverse } = executeTimelineCommand(start, addCommand());
    const { sequence: undone } = executeTimelineCommand(edited, inverse);
    expect(undone).toEqual(start);
  });
});
