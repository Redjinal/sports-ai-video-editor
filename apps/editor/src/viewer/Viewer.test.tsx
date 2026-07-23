/** @vitest-environment happy-dom */
// The program viewer renders the visual objects that are live at the playhead using the domain's
// evaluated transforms, and supports direct manipulation: a drag moves the object and commits one
// reversible SetTransform on the shared session. These tests drive it through pointer events.
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import {
  asTicks,
  TIMESCALE,
  evaluateAnimatable,
  type Sequence,
  type TextObject,
  type GraphicObject,
} from "@sve/timeline-domain";
import { Viewer } from "./Viewer";
import { useTimeline } from "../timeline/useTimeline";

afterEach(cleanup);
const S = TIMESCALE;

function ranged(id: string, start: number, duration: number) {
  return {
    id,
    trackId: "GFX",
    startTicks: asTicks(start),
    durationTicks: asTicks(duration),
    enabled: true,
    sourceInTicks: asTicks(0),
    sourceDurationTicks: asTicks(duration),
    playbackRate: 1 as const,
    name: id,
  };
}

const title: TextObject = {
  ...ranged("title", 0, S * 4),
  kind: "text",
  text: "LIONS vs HAWKS",
  style: { fontFamily: "Inter", fontSizePx: 96, color: "#ffffff", weight: 800, align: "center" },
};

const later: GraphicObject = {
  ...ranged("later", S * 10, S * 4),
  kind: "graphic",
  graphic: { type: "shape", shape: "rectangle", fill: "#0a0d12", radius: 8 },
};

function seqWith(objects: (TextObject | GraphicObject)[]): Sequence {
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
        id: "GFX",
        name: "GFX",
        type: "graphic",
        order: 0,
        height: 44,
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

function Harness({ seq, changes }: { seq: Sequence; changes: Sequence[] }) {
  const tl = useTimeline(seq, { onChange: (s) => changes.push(s) });
  return <Viewer tl={tl} />;
}

function setup(seq: Sequence) {
  const changes: Sequence[] = [];
  render(<Harness seq={seq} changes={changes} />);
  const latest = () => changes[changes.length - 1] ?? seq;
  const obj = (id: string) => document.querySelector(`[data-obj-id="${id}"]`);
  return { changes, latest, obj };
}

describe("Viewer", () => {
  it("renders only the objects live at the playhead", () => {
    const { obj } = setup(seqWith([title, later]));
    expect(screen.getByText("LIONS vs HAWKS")).toBeTruthy(); // title spans [0,4s), playhead 0
    expect(obj("title")).toBeTruthy();
    expect(obj("later")).toBeNull(); // starts at 10s — not visible yet
    expect(screen.getByText(/1 layer at playhead/)).toBeTruthy();
  });

  it("selects an object on pointer-down", () => {
    const { obj } = setup(seqWith([title]));
    fireEvent.pointerDown(obj("title")!, { clientX: 0, clientY: 0 });
    fireEvent.pointerUp(window, { clientX: 0, clientY: 0 });
    expect(obj("title")!.className).toContain("is-selected");
  });

  it("moves the object by dragging and commits one reversible SetTransform", () => {
    const { latest, changes, obj } = setup(seqWith([title]));
    // stage scale is 640/1920 = 1/3, so a 30px screen drag is 90 frame px.
    fireEvent.pointerDown(obj("title")!, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(window, { clientX: 30, clientY: 15 });
    fireEvent.pointerUp(window, { clientX: 30, clientY: 15 });
    const moved = latest().objects.find((o) => o.id === "title")!;
    expect(evaluateAnimatable(moved.transform!.x, 0)).toBeCloseTo(90, 0);
    expect(evaluateAnimatable(moved.transform!.y, 0)).toBeCloseTo(45, 0);
    // Exactly one command entered history for the whole drag (not one per move event).
    expect(changes).toHaveLength(1);
  });

  it("shows a scale handle only for the selected object", () => {
    const { obj } = setup(seqWith([title]));
    expect(screen.queryByLabelText(/^Scale/)).toBeNull();
    fireEvent.pointerDown(obj("title")!, { clientX: 0, clientY: 0 });
    fireEvent.pointerUp(window, { clientX: 0, clientY: 0 });
    expect(screen.getByLabelText("Scale title")).toBeTruthy();
  });
});
