// User templates: capture a selection as a normalised, self-contained bundle and stamp fresh,
// re-referenced copies back onto a sequence as one atomic (single-undo) command.
import { describe, it, expect } from "vitest";
import { asTicks, TIMESCALE } from "./ticks";
import type { Sequence, TextObject, GraphicObject, TransitionObject } from "./model";
import type { CommandMeta } from "./commands";
import { createHistory, execute, undo } from "./history";
import { createTemplate, instantiateTemplate } from "./templates";

const S = TIMESCALE;
let n = 0;
function meta(): CommandMeta {
  n += 1;
  return { id: `cmd_${n}`, version: 1, sequenceId: "seq_1", timestamp: "2026-07-22T00:00:00Z" };
}

function ranged(id: string, start: number, duration: number, trackId = "GFX") {
  return {
    id,
    trackId,
    startTicks: asTicks(start),
    durationTicks: asTicks(duration),
    enabled: true,
    sourceInTicks: asTicks(0),
    sourceDurationTicks: asTicks(duration),
    playbackRate: 1 as const,
  };
}

const title: TextObject = {
  ...ranged("title", S * 2, S * 4),
  kind: "text",
  text: "LIONS vs HAWKS",
  style: { fontFamily: "Inter", fontSizePx: 96, color: "#ffffff", weight: 800, align: "center" },
};
const lower: GraphicObject = {
  ...ranged("lower", S * 3, S * 3),
  kind: "graphic",
  graphic: { type: "lowerThird", title: "Alex Rivers", subtitle: "#23", accent: "#f5a524" },
};
// A transition linking the two, to prove intra-selection refs are rewritten.
const trans: TransitionObject = {
  ...ranged("t1", S * 2, S * 1),
  kind: "transition",
  transition: { type: "crossDissolve" },
  fromId: "title",
  toId: "lower",
};

function seq(): Sequence {
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
        order: 1,
        height: 44,
        color: "#334155",
        locked: false,
        hidden: false,
        muted: false,
        solo: false,
        editTargeted: true,
      },
    ],
    objects: [title, lower, trans],
    markers: [],
    parentSequenceIds: [],
  };
}

describe("templates", () => {
  it("normalises the earliest object to tick 0 and keeps relative offsets", () => {
    const t = createTemplate(seq(), ["title", "lower", "t1"], {
      id: "tpl_1",
      name: "Broadcast open",
      createdAt: "2026-07-22T00:00:00Z",
    });
    const byId = Object.fromEntries(t.objects.map((o) => [o.id, o]));
    expect(byId.title!.startTicks).toBe(0); // earliest was S*2 -> 0
    expect(byId.t1!.startTicks).toBe(0); // also at S*2
    expect(byId.lower!.startTicks).toBe(S * 1); // S*3 - S*2
  });

  it("rejects a missing id and an empty selection", () => {
    expect(() => createTemplate(seq(), ["nope"], { id: "x", name: "x", createdAt: "t" })).toThrow(
      /not in the sequence/,
    );
    expect(() => createTemplate(seq(), [], { id: "x", name: "x", createdAt: "t" })).toThrow(
      /at least one/,
    );
  });

  it("stamps fresh ids at the playhead and rewrites intra-template references", () => {
    const t = createTemplate(seq(), ["title", "lower", "t1"], {
      id: "tpl_1",
      name: "open",
      createdAt: "t",
    });
    const batch = instantiateTemplate(t, {
      atTicks: asTicks(S * 10),
      meta: meta(),
      idFactory: (local) => `new_${local}`,
    });
    let h = createHistory({ ...seq(), objects: [] });
    h = execute(h, batch);

    const objs = h.sequence.objects;
    expect(objs).toHaveLength(3);
    const newTitle = objs.find((o) => o.id === "new_title")!;
    const newTrans = objs.find((o) => o.id === "new_t1")! as TransitionObject;
    // Placed at the playhead, preserving the internal offset.
    expect(newTitle.startTicks).toBe(S * 10);
    expect(objs.find((o) => o.id === "new_lower")!.startTicks).toBe(S * 11);
    // The transition now points at the NEW object ids, not the template-local ones.
    expect(newTrans.fromId).toBe("new_title");
    expect(newTrans.toId).toBe("new_lower");
  });

  it("stamps as one atomic, single-undo command", () => {
    const t = createTemplate(seq(), ["title", "lower"], { id: "tpl", name: "n", createdAt: "t" });
    let h = createHistory({ ...seq(), objects: [] });
    h = execute(
      h,
      instantiateTemplate(t, {
        atTicks: asTicks(0),
        meta: meta(),
        idFactory: (local) => `k_${local}`,
      }),
    );
    expect(h.sequence.objects).toHaveLength(2);
    h = undo(h); // one undo removes the whole stamp
    expect(h.sequence.objects).toHaveLength(0);
  });

  it("remaps track ids when a trackMap is supplied", () => {
    const t = createTemplate(seq(), ["title"], { id: "tpl", name: "n", createdAt: "t" });
    const batch = instantiateTemplate(t, {
      atTicks: asTicks(0),
      meta: meta(),
      idFactory: (local) => `k_${local}`,
      trackMap: { GFX: "TITLES" },
    });
    expect(batch.commands[0]!.type).toBe("AddObject");
    const cmd = batch.commands[0]!;
    if (cmd.type === "AddObject") expect(cmd.object.trackId).toBe("TITLES");
  });
});
