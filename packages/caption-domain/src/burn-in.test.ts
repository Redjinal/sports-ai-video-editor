import { describe, expect, it } from "vitest";
import { asTicks } from "@sve/timeline-domain";
import { buildCaptionBurnInSpec } from "./burn-in";
import { DEFAULT_CAPTION_STYLE, type CaptionStyle, type CaptionTrack } from "./caption";

describe("buildCaptionBurnInSpec", () => {
  it("resolves each cue's style: override wins, otherwise the track default", () => {
    const override: CaptionStyle = { ...DEFAULT_CAPTION_STYLE, color: "#ff0000" };
    const track: CaptionTrack = {
      id: "captions",
      defaultStyle: DEFAULT_CAPTION_STYLE,
      captions: [
        { id: "c1", startTicks: asTicks(0), endTicks: asTicks(1_000), lines: ["a"] },
        {
          id: "c2",
          startTicks: asTicks(1_000),
          endTicks: asTicks(2_000),
          lines: ["b"],
          style: override,
        },
      ],
    };
    const spec = buildCaptionBurnInSpec(track);
    expect(spec.trackId).toBe("captions");
    expect(spec.cues[0]?.style).toEqual(DEFAULT_CAPTION_STYLE);
    expect(spec.cues[1]?.style).toEqual(override);
    expect(spec.cues[0]?.startTicks).toBe(asTicks(0));
    expect(spec.cues[1]?.lines).toEqual(["b"]);
  });
});
