import { describe, it, expect } from "vitest";
import { sidecarDescriptorsFor, planCaptions, BURN_IN_INSTRUCTION } from "./captions";

describe("sidecarDescriptorsFor", () => {
  it("produces .srt and .vtt beside the output by default", () => {
    const sidecars = sidecarDescriptorsFor("game_highlights.mp4");
    expect(sidecars).toEqual([
      { format: "srt", fileName: "game_highlights.srt" },
      { format: "vtt", fileName: "game_highlights.vtt" },
    ]);
  });

  it("respects a restricted format list", () => {
    const sidecars = sidecarDescriptorsFor("out.mp4", ["vtt"]);
    expect(sidecars).toEqual([{ format: "vtt", fileName: "out.vtt" }]);
  });

  it("handles a filename with no extension", () => {
    expect(sidecarDescriptorsFor("output", ["srt"])).toEqual([
      { format: "srt", fileName: "output.srt" },
    ]);
  });
});

describe("planCaptions", () => {
  it("returns mode 'none' for no captions", () => {
    expect(planCaptions("none", "out.mp4")).toEqual({ mode: "none" });
  });

  it("returns the burn-in instruction flag for burnIn", () => {
    expect(planCaptions("burnIn", "out.mp4")).toEqual({
      mode: "burnIn",
      instruction: BURN_IN_INSTRUCTION,
    });
  });

  it("returns sidecar descriptors for sidecar", () => {
    const plan = planCaptions("sidecar", "out.mp4");
    expect(plan.mode).toBe("sidecar");
    if (plan.mode === "sidecar") {
      expect(plan.sidecars).toEqual([
        { format: "srt", fileName: "out.srt" },
        { format: "vtt", fileName: "out.vtt" },
      ]);
    }
  });
});
