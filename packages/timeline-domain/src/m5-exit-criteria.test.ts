// M5 exit criteria (02-phase-roadmap.md §9), state half (Gate B):
// "A complete branded title, lower-third, and overlay sequence can be created non-destructively
//  and survives save/reopen."
//
// Builds a title + lower-third + shape overlay through the command history — with keyframed
// transforms — then serialize/reopens it and undoes the whole session back to empty. The
// interface half (Gate A: the inspector) is covered by the editor UI.
import { describe, it, expect } from "vitest";
import { asTicks, TIMESCALE } from "./ticks";
import type { Sequence, TextObject, GraphicObject } from "./model";
import { defaultTransform, evaluateTransform, upsertKeyframe, kf } from "./transform";
import { createHistory, execute, undo } from "./history";
import type { AddObjectCommand, SetTransformCommand, CommandMeta } from "./commands";
import { parseSequence, serializeSequence } from "./serialization";

const S = TIMESCALE;
let n = 0;
function meta(): CommandMeta {
  n += 1;
  return {
    id: `cmd_${n}`,
    version: 1,
    sequenceId: "seq_master",
    timestamp: "2026-07-22T00:00:00Z",
  };
}

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
  };
}

function emptyBrandSequence(): Sequence {
  return {
    id: "seq_master",
    name: "Broadcast open",
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
    objects: [],
    markers: [],
    parentSequenceIds: [],
  };
}

describe("M5 exit criteria — branded overlay sequence", () => {
  it("creates a title + lower-third + overlay non-destructively and survives save/reopen", () => {
    const start = emptyBrandSequence();
    let h = createHistory(start);

    // 1. Title text.
    const title: TextObject = {
      ...ranged("title", 0, S * 4),
      kind: "text",
      text: "LIONS vs HAWKS",
      style: {
        fontFamily: "Inter",
        fontSizePx: 96,
        color: "#ffffff",
        weight: 800,
        align: "center",
      },
    };
    h = execute(h, { type: "AddObject", meta: meta(), object: title } satisfies AddObjectCommand);

    // 2. Lower third graphic.
    const lower: GraphicObject = {
      ...ranged("lower", S * 4, S * 5),
      kind: "graphic",
      graphic: {
        type: "lowerThird",
        title: "Alex Rivers",
        subtitle: "#23 · Guard",
        accent: "#f5a524",
      },
    };
    h = execute(h, { type: "AddObject", meta: meta(), object: lower });

    // 3. Sponsor shape overlay.
    const overlay: GraphicObject = {
      ...ranged("overlay", 0, S * 9),
      kind: "graphic",
      graphic: { type: "shape", shape: "rectangle", fill: "#0a0d12", radius: 8 },
    };
    h = execute(h, { type: "AddObject", meta: meta(), object: overlay });

    // 4. Animate the title: fade + slide in over the first second (non-destructive keyframes).
    const anim = {
      ...defaultTransform(),
      opacity: upsertKeyframe(upsertKeyframe(0, kf(0, 0)), kf(S, 100)),
      y: upsertKeyframe(upsertKeyframe(0, kf(0, 60)), kf(S, 0)),
    };
    h = execute(h, {
      type: "SetTransform",
      meta: meta(),
      objectId: "title",
      transform: anim,
    } satisfies SetTransformCommand);

    const built = h.sequence;
    expect(built.objects.map((o) => o.kind)).toEqual(["text", "graphic", "graphic"]);
    // The title animates: opacity ramps 0 -> 100 across the first second.
    const titleObj = built.objects.find((o) => o.id === "title")!;
    expect(evaluateTransform(titleObj.transform!, 0).opacity).toBe(0);
    expect(evaluateTransform(titleObj.transform!, S).opacity).toBe(100);
    expect(evaluateTransform(titleObj.transform!, S / 2).opacity).toBe(50);

    // SAVE + REOPEN — the whole branded sequence round-trips through the portable schema.
    const reopened = parseSequence(serializeSequence(built));
    expect(reopened).toEqual(built);
    // And still animates after reopen (keyframes were preserved, not baked).
    const reopenedTitle = reopened.objects.find((o) => o.id === "title")!;
    expect(evaluateTransform(reopenedTitle.transform!, S / 2).opacity).toBe(50);

    // NON-DESTRUCTIVE: undoing the whole session returns to the exact empty sequence.
    const steps = h.past.length;
    for (let i = 0; i < steps; i++) h = undo(h);
    expect(h.sequence).toEqual(start);
  });
});
