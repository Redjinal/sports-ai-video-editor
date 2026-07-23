import { describe, it, expect } from "vitest";
import { asTicks, TIMESCALE } from "@sve/timeline-domain";
import { createTrack, isAudible, effectiveGain, type Mix, type AudioBus } from "./mixer";
import { dbToGain } from "./gain";
import { fadeIn } from "./envelope";

function bus(id: string, name: string, opts: Partial<AudioBus> = {}): AudioBus {
  return { id, name, gainDb: 0, mute: false, ...opts };
}

describe("isAudible — solo/mute resolution", () => {
  it("with no solo active, every unmuted track is audible", () => {
    const mix: Mix = {
      masterGainDb: 0,
      buses: [],
      tracks: [
        createTrack({ id: "a", name: "A" }),
        createTrack({ id: "b", name: "B", mute: true }),
      ],
    };
    expect(isAudible(mix, "a")).toBe(true);
    expect(isAudible(mix, "b")).toBe(false);
  });

  it("solo overrides mute-off tracks: only the soloed track is audible", () => {
    const mix: Mix = {
      masterGainDb: 0,
      buses: [],
      tracks: [
        createTrack({ id: "a", name: "A", solo: true }),
        createTrack({ id: "b", name: "B" }), // not muted, not soloed
      ],
    };
    expect(isAudible(mix, "a")).toBe(true);
    expect(isAudible(mix, "b")).toBe(false);
  });

  it("mute always wins, even over solo", () => {
    const mix: Mix = {
      masterGainDb: 0,
      buses: [],
      tracks: [
        createTrack({ id: "a", name: "A", solo: true, mute: true }),
        createTrack({ id: "b", name: "B" }),
      ],
    };
    expect(isAudible(mix, "a")).toBe(false);
  });

  it("a muted bus silences every track routed into it, regardless of the track's own mute", () => {
    const mix: Mix = {
      masterGainDb: 0,
      buses: [bus("music", "Music", { mute: true })],
      tracks: [createTrack({ id: "a", name: "A", busId: "music" })],
    };
    expect(isAudible(mix, "a")).toBe(false);
  });

  it("an unrouted track (no busId) is unaffected by any bus mute", () => {
    const mix: Mix = {
      masterGainDb: 0,
      buses: [bus("music", "Music", { mute: true })],
      tracks: [createTrack({ id: "a", name: "A" })],
    };
    expect(isAudible(mix, "a")).toBe(true);
  });

  it("throws for an unknown track id", () => {
    const mix: Mix = { masterGainDb: 0, buses: [], tracks: [] };
    expect(() => isAudible(mix, "nope")).toThrow();
  });
});

describe("effectiveGain", () => {
  it("composes track gain x bus gain x master gain as a linear multiplier", () => {
    const mix: Mix = {
      masterGainDb: -6,
      buses: [bus("music", "Music", { gainDb: -6 })],
      tracks: [createTrack({ id: "a", name: "A", gainDb: -6, busId: "music" })],
    };
    const gain = effectiveGain(mix, "a", asTicks(0));
    expect(gain).toBeCloseTo(dbToGain(-6) * dbToGain(-6) * dbToGain(-6), 9);
  });

  it("is unity when track/bus/master are all at 0 dB and there is no envelope", () => {
    const mix: Mix = {
      masterGainDb: 0,
      buses: [bus("music", "Music")],
      tracks: [createTrack({ id: "a", name: "A", busId: "music" })],
    };
    expect(effectiveGain(mix, "a", asTicks(0))).toBeCloseTo(1, 9);
  });

  it("an unrouted track is unaffected by any bus and feeds master directly", () => {
    const mix: Mix = {
      masterGainDb: -3,
      buses: [bus("music", "Music", { gainDb: -100 })],
      tracks: [createTrack({ id: "a", name: "A" })],
    };
    expect(effectiveGain(mix, "a", asTicks(0))).toBeCloseTo(dbToGain(-3), 9);
  });

  it("multiplies in the track's volume automation envelope at the given tick", () => {
    const mix: Mix = {
      masterGainDb: 0,
      buses: [],
      tracks: [
        createTrack({
          id: "a",
          name: "A",
          envelope: fadeIn(asTicks(0), asTicks(TIMESCALE)),
        }),
      ],
    };
    expect(effectiveGain(mix, "a", asTicks(0))).toBe(0);
    expect(effectiveGain(mix, "a", asTicks(TIMESCALE))).toBeCloseTo(1, 9);
    expect(effectiveGain(mix, "a", asTicks(TIMESCALE / 2))).toBeCloseTo(0.5, 9);
  });

  it("does not itself zero out a muted/soloed-away track — combine with isAudible for playback", () => {
    const mix: Mix = {
      masterGainDb: 0,
      buses: [],
      tracks: [createTrack({ id: "a", name: "A", mute: true, gainDb: -6 })],
    };
    // effectiveGain is pure level math; muting is a separate, audibility-level concern.
    expect(effectiveGain(mix, "a", asTicks(0))).toBeCloseTo(dbToGain(-6), 9);
    expect(isAudible(mix, "a")).toBe(false);
  });
});

describe("createTrack", () => {
  it("omits optional keys entirely when not provided (exactOptionalPropertyTypes-safe)", () => {
    const track = createTrack({ id: "a", name: "A" });
    expect("busId" in track).toBe(false);
    expect("envelope" in track).toBe(false);
  });

  it("applies sane defaults", () => {
    const track = createTrack({ id: "a", name: "A" });
    expect(track.gainDb).toBe(0);
    expect(track.pan).toBe(0);
    expect(track.mute).toBe(false);
    expect(track.solo).toBe(false);
  });
});
