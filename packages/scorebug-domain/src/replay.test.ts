import { describe, it, expect } from "vitest";
import { asTicks } from "@sve/timeline-domain";
import { buildReplay, replaySpecSchema, toNestedReplayDescriptor, REPLAY_RATES } from "./replay";

const TICKS_PER_SECOND = 27_000_000;

function seconds(n: number) {
  return asTicks(Math.round(n * TICKS_PER_SECOND));
}

describe("buildReplay", () => {
  it.each(REPLAY_RATES)("builds a valid spec at the fixed rate %s", (rate) => {
    const spec = buildReplay({
      id: "replay_1",
      sourceSequenceId: "seq_master",
      startTicks: seconds(10),
      endTicks: seconds(14),
      rate,
      audioMode: "mute",
    });
    expect(spec.rate).toBe(rate);
    expect(spec.durationTicks).toBe(seconds(4 / rate));
  });

  it("scales the effective duration by 1/rate", () => {
    const fourSecondRange = { startTicks: seconds(0), endTicks: seconds(4) };

    const at2x = buildReplay({
      id: "r_2x",
      sourceSequenceId: "seq_master",
      ...fourSecondRange,
      rate: 2,
      audioMode: "full",
    });
    const atHalf = buildReplay({
      id: "r_half",
      sourceSequenceId: "seq_master",
      ...fourSecondRange,
      rate: 0.5,
      audioMode: "full",
    });
    const atRealTime = buildReplay({
      id: "r_1x",
      sourceSequenceId: "seq_master",
      ...fourSecondRange,
      rate: 1,
      audioMode: "full",
    });

    // A 2x replay of a 4s range plays in 2s; a 0.5x replay of the same range plays in 8s.
    expect(at2x.durationTicks).toBe(seconds(2));
    expect(atHalf.durationTicks).toBe(seconds(8));
    expect(atRealTime.durationTicks).toBe(seconds(4));
  });

  it("defaults the bumper when none is supplied", () => {
    const spec = buildReplay({
      id: "replay_default_bumper",
      sourceSequenceId: "seq_master",
      startTicks: seconds(0),
      endTicks: seconds(2),
      rate: 1,
      audioMode: "music",
    });
    expect(spec.bumper).toEqual({ in: false, out: false });
  });

  it("carries a supplied bumper through unchanged", () => {
    const spec = buildReplay({
      id: "replay_bumper",
      sourceSequenceId: "seq_master",
      startTicks: seconds(0),
      endTicks: seconds(2),
      rate: 1,
      bumper: { in: true, out: false, assetId: "bumper_in" },
      audioMode: "full",
    });
    expect(spec.bumper).toEqual({ in: true, out: false, assetId: "bumper_in" });
  });

  it("rejects an empty or inverted source range", () => {
    expect(() =>
      buildReplay({
        id: "bad_empty",
        sourceSequenceId: "seq_master",
        startTicks: seconds(4),
        endTicks: seconds(4),
        rate: 1,
        audioMode: "mute",
      }),
    ).toThrow(RangeError);

    expect(() =>
      buildReplay({
        id: "bad_inverted",
        sourceSequenceId: "seq_master",
        startTicks: seconds(4),
        endTicks: seconds(2),
        rate: 1,
        audioMode: "mute",
      }),
    ).toThrow(RangeError);
  });
});

describe("toNestedReplayDescriptor", () => {
  it("produces a portable descriptor a later command layer can instantiate", () => {
    const spec = buildReplay({
      id: "replay_2",
      sourceSequenceId: "seq_master",
      startTicks: seconds(20),
      endTicks: seconds(24),
      rate: 2,
      bumper: { in: true, out: true, assetId: "bumper_asset" },
      audioMode: "music",
    });
    const descriptor = toNestedReplayDescriptor(spec);
    expect(descriptor.kind).toBe("nested_replay_sequence");
    expect(descriptor.replayId).toBe("replay_2");
    expect(descriptor.sourceSequenceId).toBe("seq_master");
    expect(descriptor.sourceRange).toEqual({ startTicks: seconds(20), endTicks: seconds(24) });
    expect(descriptor.rate).toBe(2);
    expect(descriptor.audioMode).toBe("music");
    expect(descriptor.durationTicks).toBe(seconds(2));
    expect(descriptor.bumper.assetId).toBe("bumper_asset");
  });
});

describe("replaySpecSchema round-trip", () => {
  it("parses a built replay spec back to an equivalent value through JSON", () => {
    const spec = buildReplay({
      id: "replay_3",
      sourceSequenceId: "seq_master",
      startTicks: seconds(0),
      endTicks: seconds(6),
      rate: 0.25,
      audioMode: "full",
    });
    const parsed = replaySpecSchema.parse(JSON.parse(JSON.stringify(spec)));
    expect(parsed).toEqual(spec);
  });

  it("rejects an inverted range at the schema boundary", () => {
    expect(() =>
      replaySpecSchema.parse({
        id: "x",
        sourceSequenceId: "seq_master",
        startTicks: 100,
        endTicks: 50,
        rate: 1,
        bumper: { in: false, out: false },
        audioMode: "mute",
        durationTicks: 50,
      }),
    ).toThrow();
  });

  it("rejects a rate outside the fixed set", () => {
    expect(() =>
      replaySpecSchema.parse({
        id: "x",
        sourceSequenceId: "seq_master",
        startTicks: 0,
        endTicks: 100,
        rate: 3,
        bumper: { in: false, out: false },
        audioMode: "mute",
        durationTicks: 33,
      }),
    ).toThrow();
  });
});
