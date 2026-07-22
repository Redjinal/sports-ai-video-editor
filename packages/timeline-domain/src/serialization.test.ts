import { describe, it, expect } from "vitest";
import { asTicks, TIMESCALE } from "./ticks";
import type { Sequence } from "./model";
import { parseSequence, serializeSequence } from "./serialization";

function sampleSequence(): Sequence {
  return {
    id: "seq_1",
    name: "Slice",
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
    objects: [
      {
        kind: "clip",
        id: "clp_1",
        trackId: "trk_v1",
        startTicks: asTicks(0),
        durationTicks: asTicks(TIMESCALE * 2),
        enabled: true,
        assetId: "ast_1",
        sourceInTicks: asTicks(0),
        sourceDurationTicks: asTicks(TIMESCALE * 2),
        playbackRate: 1,
      },
    ],
    markers: [],
    parentSequenceIds: [],
  };
}

describe("sequence serialization", () => {
  it("round-trips through serialize/parse", () => {
    const seq = sampleSequence();
    const restored = parseSequence(serializeSequence(seq));
    expect(restored).toEqual(seq);
  });

  it("rejects a zero-duration object", () => {
    const bad = serializeSequence(sampleSequence()) as { objects: { durationTicks: number }[] };
    bad.objects[0]!.durationTicks = 0;
    expect(() => parseSequence(bad)).toThrow();
  });

  it("rejects non-integer authoritative ticks", () => {
    const bad = serializeSequence(sampleSequence()) as { objects: { startTicks: number }[] };
    bad.objects[0]!.startTicks = 1.5;
    expect(() => parseSequence(bad)).toThrow();
  });
});
