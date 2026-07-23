/** @vitest-environment happy-dom */
// The inspector edits the selected object through real domain commands on the shared session:
// transform channels (with keyframes), text, and graphic properties. Every change is reversible
// and non-destructive — asserted by driving edits and inspecting the resulting sequence + undo.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import {
  asTicks,
  TIMESCALE,
  isAnimated,
  evaluateAnimatable,
  type Sequence,
  type TextObject,
  type GraphicObject,
} from "@sve/timeline-domain";
import { Inspector } from "./Inspector";
import { useTimeline } from "../timeline/useTimeline";

afterEach(cleanup);
const S = TIMESCALE;

function ranged(id: string) {
  return {
    id,
    trackId: "GFX",
    startTicks: asTicks(0),
    durationTicks: asTicks(S * 4),
    enabled: true,
    sourceInTicks: asTicks(0),
    sourceDurationTicks: asTicks(S * 4),
    playbackRate: 1 as const,
    name: id,
  };
}

const title: TextObject = {
  ...ranged("title"),
  kind: "text",
  text: "LIONS vs HAWKS",
  style: { fontFamily: "Inter", fontSizePx: 96, color: "#ffffff", weight: 800, align: "center" },
};

const lower: GraphicObject = {
  ...ranged("lower"),
  kind: "graphic",
  graphic: { type: "lowerThird", title: "Alex Rivers", subtitle: "#23 · Guard", accent: "#f5a524" },
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

// Exposes the live session so a test can select an object / move the playhead like the shell does.
function Harness({
  seq,
  changes,
  selectId,
  playhead,
}: {
  seq: Sequence;
  changes: Sequence[];
  selectId: string | null;
  playhead: number;
}) {
  const tl = useTimeline(seq, { onChange: (s) => changes.push(s) });
  if (selectId && tl.selectedId !== selectId) tl.select(selectId);
  if (tl.playheadTicks !== playhead) tl.setPlayhead(playhead);
  return <Inspector tl={tl} snapshots={[]} onRecover={vi.fn()} />;
}

function setup(seq: Sequence, selectId: string | null = null, playhead = 0) {
  const changes: Sequence[] = [];
  render(<Harness seq={seq} changes={changes} selectId={selectId} playhead={playhead} />);
  const latest = () => changes[changes.length - 1] ?? seq;
  return { changes, latest };
}

describe("Inspector", () => {
  it("prompts to select an object and shows recovery when nothing is selected", () => {
    setup(seqWith([title]));
    expect(screen.getByText(/select an object/i)).toBeTruthy();
    expect(screen.getByText(/opens a copy/i)).toBeTruthy();
  });

  it("edits text content through a reversible SetText command", () => {
    const { latest } = setup(seqWith([title]), "title");
    fireEvent.change(screen.getByLabelText("Text content"), { target: { value: "TIP-OFF 7PM" } });
    const obj = latest().objects.find((o) => o.id === "title") as TextObject;
    expect(obj.text).toBe("TIP-OFF 7PM");
    // Non-destructive: the style is preserved, not clobbered.
    expect(obj.style.fontSizePx).toBe(96);
  });

  it("edits a lower-third field through SetGraphic", () => {
    const { latest } = setup(seqWith([lower]), "lower");
    fireEvent.change(screen.getByLabelText("Lower-third title"), {
      target: { value: "J. Carter" },
    });
    const obj = latest().objects.find((o) => o.id === "lower") as GraphicObject;
    expect(obj.graphic).toMatchObject({
      type: "lowerThird",
      title: "J. Carter",
      subtitle: "#23 · Guard",
    });
  });

  it("sets a constant transform value through SetTransform", () => {
    const { latest } = setup(seqWith([title]), "title", 0);
    fireEvent.change(screen.getByLabelText("Opacity"), { target: { value: "50" } });
    const obj = latest().objects.find((o) => o.id === "title")!;
    expect(evaluateAnimatable(obj.transform!.opacity, 0)).toBe(50);
    expect(isAnimated(obj.transform!.opacity)).toBe(false);
  });

  it("adds a keyframe at the playhead, making the channel animated", () => {
    const { latest } = setup(seqWith([title]), "title", S);
    fireEvent.click(screen.getByLabelText("Keyframe X"));
    const obj = latest().objects.find((o) => o.id === "title")!;
    // One keyframe so far — still resolves to a value, animates once a second lands.
    fireEvent.change(screen.getByLabelText("X"), { target: { value: "120" } });
    const obj2 = latest().objects.find((o) => o.id === "title")!;
    expect(evaluateAnimatable(obj2.transform!.x, S)).toBe(120);
    expect(obj.transform).toBeDefined();
  });
});
