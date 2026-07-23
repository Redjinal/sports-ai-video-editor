// Multicam (M7): four synchronised angles, live switching, editable switch points, active-angle
// replacement, angle lock, audio-angle selection — all non-destructive, reversible, and surviving
// save/reopen. Exercises the pure helpers and the SetMulticam command through history.
import { describe, it, expect } from "vitest";
import { asTicks, TIMESCALE } from "./ticks";
import type { MulticamObject, Sequence } from "./model";
import type { CommandMeta, SetMulticamCommand } from "./commands";
import { createHistory, execute, undo } from "./history";
import { parseSequence, serializeSequence } from "./serialization";
import {
  activeAngleAt,
  angleForKey,
  applyOffset,
  moveSwitch,
  multicamProgram,
  removeSwitch,
  replaceAngle,
  setAudioAngle,
  switchAngle,
  syncByTimecode,
  toggleAngleLock,
} from "./multicam";

const S = TIMESCALE;
let n = 0;
function meta(): CommandMeta {
  n += 1;
  return { id: `cmd_${n}`, version: 1, sequenceId: "seq_1", timestamp: "2026-07-22T00:00:00Z" };
}

function mc(): MulticamObject {
  return {
    kind: "multicam",
    id: "mc1",
    trackId: "MC",
    startTicks: asTicks(0),
    durationTicks: asTicks(S * 60),
    enabled: true,
    sourceInTicks: asTicks(0),
    sourceDurationTicks: asTicks(S * 60),
    playbackRate: 1,
    angles: [
      { id: "a1", assetId: "cam1", offsetTicks: asTicks(0), label: "Wide" },
      { id: "a2", assetId: "cam2", offsetTicks: asTicks(0), label: "Baseline" },
      { id: "a3", assetId: "cam3", offsetTicks: asTicks(0), label: "Tight" },
      { id: "a4", assetId: "cam4", offsetTicks: asTicks(0), label: "Reverse" },
    ],
    switches: [{ atTicks: asTicks(0), angleId: "a1" }],
    audioAngleId: "a1",
    lockedAngleIds: [],
  };
}

function seqWith(obj: MulticamObject): Sequence {
  return {
    id: "seq_1",
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
        id: "MC",
        name: "Multicam",
        type: "multicam",
        order: 0,
        height: 52,
        color: "#334155",
        locked: false,
        hidden: false,
        muted: false,
        solo: false,
        editTargeted: true,
      },
    ],
    objects: [obj],
    markers: [],
    parentSequenceIds: [],
  };
}

describe("multicam helpers", () => {
  it("derives the live angle from the switch program", () => {
    let p = multicamProgram(mc());
    p = switchAngle(p, asTicks(S * 10), "a2");
    p = switchAngle(p, asTicks(S * 20), "a3");
    const live = { ...mc(), ...p };
    expect(activeAngleAt(live, 0)).toBe("a1");
    expect(activeAngleAt(live, S * 5)).toBe("a1");
    expect(activeAngleAt(live, S * 15)).toBe("a2");
    expect(activeAngleAt(live, S * 25)).toBe("a3");
  });

  it("maps keys 1-4 to the first four angles", () => {
    const m = mc();
    expect(angleForKey(m, 1)).toBe("a1");
    expect(angleForKey(m, 4)).toBe("a4");
  });

  it("refuses to switch to a locked or unknown angle", () => {
    let p = multicamProgram(mc());
    p = toggleAngleLock(p, "a2"); // lock a2
    const before = p.switches.length;
    p = switchAngle(p, asTicks(S * 5), "a2"); // rejected — locked
    expect(p.switches.length).toBe(before);
    p = switchAngle(p, asTicks(S * 5), "nope"); // rejected — unknown
    expect(p.switches.length).toBe(before);
    p = switchAngle(p, asTicks(S * 5), "a3"); // allowed
    expect(p.switches.length).toBe(before + 1);
  });

  it("moves and removes switch points (editable program)", () => {
    let p = multicamProgram(mc());
    p = switchAngle(p, asTicks(S * 10), "a2");
    p = moveSwitch(p, 1, asTicks(S * 15)); // move the a2 switch later
    expect(p.switches.find((s) => s.angleId === "a2")!.atTicks).toBe(S * 15);
    p = removeSwitch(p, 1);
    expect(p.switches.some((s) => s.angleId === "a2")).toBe(false);
  });

  it("replaces an active angle everywhere it is live", () => {
    let p = multicamProgram(mc());
    p = switchAngle(p, asTicks(S * 10), "a2");
    p = switchAngle(p, asTicks(S * 20), "a2");
    p = replaceAngle(p, "a2", "a4");
    expect(p.switches.filter((s) => s.angleId === "a2")).toHaveLength(0);
    expect(p.switches.filter((s) => s.angleId === "a4")).toHaveLength(2);
  });

  it("selects an independent audio angle", () => {
    let p = multicamProgram(mc());
    p = setAudioAngle(p, "a3");
    expect(p.audioAngleId).toBe("a3");
    p = setAudioAngle(p, "ghost"); // unknown ignored
    expect(p.audioAngleId).toBe("a3");
  });

  it("timecode-syncs angles by delaying the earliest-shot camera most", () => {
    const m = mc();
    m.angles[0]!.timecodeStartTicks = asTicks(0); // earliest
    m.angles[1]!.timecodeStartTicks = asTicks(S * 2); // latest
    const p = syncByTimecode(multicamProgram(m));
    // latest start is S*2, so a1 (start 0) gets offset +S*2, a2 (start S*2) gets 0.
    expect(p.angles[0]!.offsetTicks).toBe(S * 2);
    expect(p.angles[1]!.offsetTicks).toBe(0);
  });

  it("applies a manual sync offset", () => {
    const p = applyOffset(multicamProgram(mc()), "a2", asTicks(S));
    expect(p.angles.find((a) => a.id === "a2")!.offsetTicks).toBe(S);
  });
});

describe("multicam command + persistence", () => {
  it("switches through a reversible SetMulticam command and survives save/reopen", () => {
    const start = seqWith(mc());
    let h = createHistory(start);
    const p = switchAngle(multicamProgram(mc()), asTicks(S * 10), "a2");
    const cmd: SetMulticamCommand = {
      type: "SetMulticam",
      meta: meta(),
      objectId: "mc1",
      angles: p.angles,
      switches: p.switches,
      audioAngleId: p.audioAngleId,
      lockedAngleIds: p.lockedAngleIds,
    };
    h = execute(h, cmd);

    const live = h.sequence.objects[0] as MulticamObject;
    expect(activeAngleAt(live, S * 15)).toBe("a2");

    // Save + reopen round-trips the whole multicam program.
    const reopened = parseSequence(serializeSequence(h.sequence));
    expect(reopened).toEqual(h.sequence);

    // Undo returns to the single opening switch.
    h = undo(h);
    expect((h.sequence.objects[0] as MulticamObject).switches).toHaveLength(1);
  });

  it("rejects SetMulticam on a non-multicam object", () => {
    const start = seqWith(mc());
    let h = createHistory(start);
    expect(
      () =>
        (h = execute(h, {
          type: "SetMulticam",
          meta: meta(),
          objectId: "does-not-exist",
          angles: [],
          switches: [],
          audioAngleId: "",
          lockedAngleIds: [],
        })),
    ).toThrow();
  });
});
