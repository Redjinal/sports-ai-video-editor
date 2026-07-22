// Integration: timeline edit -> embed in manifest -> atomic save -> reopen -> undo.
// Exercises timeline-domain + project-domain + persistence + application-services together
// (Gate B: save/reopen must not change the edit; undo must be deterministic).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  asTicks,
  TIMESCALE,
  type Sequence,
  type SourceClip,
  type AddObjectCommand,
} from "@sve/timeline-domain";
import { createEmptyManifest, type ProjectManifest } from "@sve/project-domain";
import { FileProjectRepository } from "@sve/persistence";
import { executeTimelineCommand } from "@sve/application-services";

let dir: string;
const repo = new FileProjectRepository();

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "sve-int-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

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
  it("persists a placed clip and reopens with the edit intact", async () => {
    const add: AddObjectCommand = {
      type: "AddObject",
      meta: {
        id: "cmd_1",
        version: 1,
        sequenceId: "seq_master",
        timestamp: "2026-07-22T00:00:00.000Z",
      },
      object: clip(),
    };
    const { sequence: edited } = executeTimelineCommand(emptySequence(), add);
    expect(edited.objects).toHaveLength(1);

    await repo.save(dir, manifestWith(edited));
    const reopened = await repo.load(dir);

    expect(reopened.sequences[0]!.objects).toHaveLength(1);
    expect(reopened.sequences[0]!.objects[0]!.durationTicks).toBe(TIMESCALE * 5);
    expect(reopened.activeMasterSequenceId).toBe("seq_master");
  });

  it("undo returns the sequence to its pre-edit state", () => {
    const start = emptySequence();
    const add: AddObjectCommand = {
      type: "AddObject",
      meta: {
        id: "cmd_1",
        version: 1,
        sequenceId: "seq_master",
        timestamp: "2026-07-22T00:00:00.000Z",
      },
      object: clip(),
    };
    const { sequence: edited, inverse } = executeTimelineCommand(start, add);
    const { sequence: undone } = executeTimelineCommand(edited, inverse);
    expect(undone).toEqual(start);
  });
});
