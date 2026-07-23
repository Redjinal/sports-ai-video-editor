/** @vitest-environment happy-dom */
// The timeline view must drive the real @sve/timeline-domain kernel: edits go through domain
// commands + history (undo works, invalid edits are rejected and surfaced), and the view holds
// no authoritative timeline state. These tests exercise it through the toolbar and keyboard.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { asTicks, TIMESCALE, type Sequence, type SourceClip } from "@sve/timeline-domain";
import { Timeline } from "./Timeline";

afterEach(cleanup);
const S = TIMESCALE;

function clip(id: string, start: number, duration: number): SourceClip {
  return {
    kind: "clip",
    id,
    trackId: "V1",
    startTicks: asTicks(start),
    durationTicks: asTicks(duration),
    enabled: true,
    assetId: "ast_1",
    sourceInTicks: asTicks(0),
    sourceDurationTicks: asTicks(duration),
    playbackRate: 1,
    name: id,
  };
}

function seqOf(objects: SourceClip[], locked = false): Sequence {
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
        id: "V1",
        name: "V1",
        type: "video",
        order: 0,
        height: 52,
        color: "#334155",
        locked,
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

function setup(seq: Sequence) {
  const changes: Sequence[] = [];
  const onError = vi.fn();
  render(<Timeline sequence={seq} onChange={(s) => changes.push(s)} onError={onError} />);
  const tl = screen.getByLabelText("Timeline");
  const latest = () => changes[changes.length - 1] ?? seq;
  const selectClip = (id: string) =>
    fireEvent.click(document.querySelector(`[data-clip-id="${id}"]`)!);
  const movePlayhead = (seconds: number) => {
    for (let i = 0; i < seconds; i++) fireEvent.keyDown(tl, { key: "ArrowRight", shiftKey: true });
  };
  return { changes, onError, latest, selectClip, movePlayhead, tl };
}

describe("Timeline — kernel wiring", () => {
  it("appends a clip through an AddObject command", () => {
    const { changes, latest } = setup(seqOf([clip("a", 0, S * 4)]));
    fireEvent.click(screen.getByRole("button", { name: "＋ Clip" }));
    expect(changes.length).toBe(1);
    expect(latest().objects).toHaveLength(2);
  });

  it("selects and deletes a clip", () => {
    const { latest, selectClip } = setup(seqOf([clip("a", 0, S * 4)]));
    selectClip("a");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(latest().objects).toHaveLength(0);
  });

  it("ripple-deletes and closes the gap", () => {
    const { latest, selectClip } = setup(seqOf([clip("a", 0, S * 4), clip("b", S * 4, S * 4)]));
    selectClip("a");
    fireEvent.click(screen.getByRole("button", { name: /Ripple/ }));
    const objs = latest().objects;
    expect(objs).toHaveLength(1);
    expect(objs[0]!.id).toBe("b");
    expect(objs[0]!.startTicks).toBe(0); // gap closed
  });

  it("splits the selected clip at the playhead", () => {
    const { latest, selectClip, movePlayhead } = setup(seqOf([clip("a", 0, S * 10)]));
    movePlayhead(5); // 5 × (shift+ArrowRight = 1s) -> playhead at 5s
    selectClip("a");
    fireEvent.keyDown(screen.getByLabelText("Timeline"), { key: "S" });
    const objs = latest().objects;
    expect(objs).toHaveLength(2);
    expect(objs.some((o) => o.startTicks === 0 && o.durationTicks === S * 5)).toBe(true);
    expect(objs.some((o) => o.startTicks === S * 5)).toBe(true);
  });

  it("undoes an edit deterministically", () => {
    const { latest, selectClip } = setup(seqOf([clip("a", 0, S * 4)]));
    selectClip("a");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(latest().objects).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: /Undo/ }));
    expect(latest().objects).toHaveLength(1);
    expect(latest().objects[0]!.id).toBe("a");
  });

  it("a locked track rejects a split and surfaces the error without changing state", () => {
    const { changes, onError, selectClip, movePlayhead } = setup(
      seqOf([clip("a", 0, S * 10)], true),
    );
    // lock is on from the start; try to split.
    movePlayhead(5);
    selectClip("a");
    fireEvent.keyDown(screen.getByLabelText("Timeline"), { key: "S" });
    expect(onError).toHaveBeenCalledWith(expect.stringMatching(/locked/i));
    expect(changes).toHaveLength(0); // failed command produced no change
  });

  it("toggles a track flag through SetTrackFlag", () => {
    const { latest } = setup(seqOf([clip("a", 0, S * 4)]));
    fireEvent.click(screen.getByTitle("Lock"));
    expect(latest().tracks.find((t) => t.id === "V1")!.locked).toBe(true);
  });
});
