/** @vitest-environment happy-dom */
// The multicam switcher drives the selected multicam object through the shared session: a live cut
// (click a tile or press 1–4) records a switch at the playhead and updates the on-air angle; the
// switch list, audio angle, and per-angle lock are editable. Every change is one SetMulticam
// command (one undo step). Locked angles reject cuts.
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import {
  asTicks,
  TIMESCALE,
  activeAngleAt,
  type MulticamObject,
  type Sequence,
} from "@sve/timeline-domain";
import { MulticamPanel } from "./MulticamPanel";
import { useTimeline, type TimelineApi } from "../timeline/useTimeline";

afterEach(cleanup);
const S = TIMESCALE;

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

// Live session seeded with the multicam selected; playhead can be advanced like the shell does.
let api: TimelineApi;
function Harness({ seq, playhead }: { seq: Sequence; playhead: number }) {
  const tl = useTimeline(seq, {});
  api = tl;
  if (tl.playheadTicks !== playhead) tl.setPlayhead(playhead);
  const obj = tl.sequence.objects[0] as MulticamObject;
  return <MulticamPanel tl={tl} obj={obj} />;
}

function setup(playhead = 0) {
  render(<Harness seq={seqWith(mc())} playhead={playhead} />);
  const current = () => api.sequence.objects[0] as MulticamObject;
  return { current };
}

describe("MulticamPanel", () => {
  it("marks the on-air angle and lists the angles", () => {
    setup();
    // All four angles have a cut button.
    for (const label of ["Wide", "Baseline", "Tight", "Reverse"]) {
      expect(screen.getByRole("button", { name: `Cut to ${label}` })).toBeTruthy();
    }
    // a1 (Wide) is on air at the start; its cut button is pressed.
    expect(screen.getByRole("button", { name: "Cut to Wide" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Cut to Baseline" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("cuts to another angle at the playhead via a SetMulticam command", () => {
    const { current } = setup(S * 10);
    fireEvent.click(screen.getByRole("button", { name: "Cut to Baseline" }));
    const obj = current();
    expect(obj.switches.some((s) => s.atTicks === S * 10 && s.angleId === "a2")).toBe(true);
    expect(activeAngleAt(obj, S * 10)).toBe("a2");
  });

  it("cuts with number keys 1–4", () => {
    const { current } = setup(S * 5);
    fireEvent.keyDown(screen.getByLabelText("Multicam"), { key: "3" });
    expect(activeAngleAt(current(), S * 5)).toBe("a3");
  });

  it("refuses to cut to a locked angle", () => {
    const { current } = setup(S * 8);
    fireEvent.click(screen.getByRole("button", { name: "Lock Baseline" }));
    fireEvent.click(screen.getByRole("button", { name: "Cut to Baseline" })); // disabled/locked
    expect(current().switches.some((s) => s.angleId === "a2")).toBe(false);
  });

  it("selects an independent audio angle", () => {
    const { current } = setup();
    fireEvent.change(screen.getByLabelText("Audio angle"), { target: { value: "a3" } });
    expect(current().audioAngleId).toBe("a3");
  });

  it("removes a switch point", () => {
    const { current } = setup(S * 10);
    fireEvent.click(screen.getByRole("button", { name: "Cut to Baseline" }));
    expect(current().switches).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Remove cut at 0:10" }));
    expect(current().switches.some((s) => s.angleId === "a2")).toBe(false);
  });
});
