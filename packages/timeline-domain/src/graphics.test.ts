// M5 graphics objects + transform commands: add text/graphic objects, set/keyframe transforms
// reversibly and non-destructively, and survive serialize/reopen.
import { describe, it, expect } from "vitest";
import { asTicks, TIMESCALE } from "./ticks";
import type { Sequence, TextObject, GraphicObject } from "./model";
import { defaultTransform, upsertKeyframe, kf } from "./transform";
import {
  applyCommand,
  type AddObjectCommand,
  type SetTransformCommand,
  type CommandMeta,
} from "./commands";
import { parseSequence, serializeSequence } from "./serialization";

const S = TIMESCALE;
function meta(id: string): CommandMeta {
  return { id, version: 1, sequenceId: "seq_1", timestamp: "2026-07-22T00:00:00Z" };
}

function ranged(id: string, trackId: string, start: number, duration: number) {
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

function textObj(id: string): TextObject {
  return {
    ...ranged(id, "GFX", 0, S * 4),
    kind: "text",
    text: "TITLE",
    style: { fontFamily: "Inter", fontSizePx: 72, color: "#fff", weight: 700, align: "center" },
  };
}

function lowerThird(id: string): GraphicObject {
  return {
    ...ranged(id, "GFX", 0, S * 5),
    kind: "graphic",
    graphic: {
      type: "lowerThird",
      title: "Alex Rivers",
      subtitle: "#23 · Guard",
      accent: "#f5a524",
    },
  };
}

function seqOf(objects: (TextObject | GraphicObject)[]): Sequence {
  return {
    id: "seq_1",
    name: "S",
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

describe("graphics objects", () => {
  it("adds a text object and inverts it", () => {
    const start = seqOf([]);
    const add: AddObjectCommand = { type: "AddObject", meta: meta("a"), object: textObj("t1") };
    const { sequence, inverse } = applyCommand(start, add);
    expect(sequence.objects[0]!.kind).toBe("text");
    expect(applyCommand(sequence, inverse).sequence).toEqual(start);
  });

  it("sets a transform and undo restores the exact prior state (including 'no transform')", () => {
    const start = seqOf([lowerThird("g1")]);
    const t = { ...defaultTransform(), x: { keyframes: [kf(0, 0), kf(S * 2, 300)] } };
    const set: SetTransformCommand = {
      type: "SetTransform",
      meta: meta("s"),
      objectId: "g1",
      transform: t,
    };
    const { sequence, inverse } = applyCommand(start, set);
    expect((sequence.objects[0] as GraphicObject).transform).toEqual(t);
    // The original had no transform; undo must restore that exactly (not an identity transform).
    const undone = applyCommand(sequence, inverse).sequence;
    expect(undone).toEqual(start);
    expect("transform" in undone.objects[0]!).toBe(false);
  });

  it("keeps editing non-destructive: setting a transform never touches text content", () => {
    const start = seqOf([textObj("t1")]);
    const t = { ...defaultTransform(), opacity: { keyframes: [kf(0, 0), kf(S, 100)] } };
    const { sequence } = applyCommand(start, {
      type: "SetTransform",
      meta: meta("s"),
      objectId: "t1",
      transform: t,
    });
    expect((sequence.objects[0] as TextObject).text).toBe("TITLE");
  });

  it("survives serialize/reopen with keyframed transforms and graphic specs", () => {
    const animated = {
      ...defaultTransform(),
      scale: upsertKeyframe(upsertKeyframe(100, kf(0, 80)), kf(S * 2, 120)),
    };
    const seq = seqOf([{ ...textObj("t1"), transform: animated }, lowerThird("g1")]);
    const restored = parseSequence(serializeSequence(seq));
    expect(restored).toEqual(seq);
    expect(restored.objects.map((o) => o.kind)).toEqual(["text", "graphic"]);
  });
});
