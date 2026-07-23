import { describe, expect, it } from "vitest";
import type { SocialAspect } from "./model";
import { reframe, reframeDimensions } from "./social";
import { masterSequence } from "./test-fixtures";

describe("reframeDimensions", () => {
  it("derives 16:9 dimensions from a 1920x1080 master's longest side", () => {
    expect(reframeDimensions({ width: 1920, height: 1080 }, "16:9")).toEqual({
      width: 1920,
      height: 1080,
    });
  });

  it("derives 9:16 dimensions, swapping the reference axis", () => {
    expect(reframeDimensions({ width: 1920, height: 1080 }, "9:16")).toEqual({
      width: 1080,
      height: 1920,
    });
  });

  it("derives 1:1 dimensions as a square on the longest side", () => {
    expect(reframeDimensions({ width: 1920, height: 1080 }, "1:1")).toEqual({
      width: 1920,
      height: 1920,
    });
  });

  it("derives 4:5 dimensions", () => {
    expect(reframeDimensions({ width: 1920, height: 1080 }, "4:5")).toEqual({
      width: 1536,
      height: 1920,
    });
  });

  it("falls back to the 1080 base when the master is smaller than that", () => {
    const small = { width: 640, height: 360 };
    expect(reframeDimensions(small, "16:9")).toEqual({ width: 1080, height: 608 });
    expect(reframeDimensions(small, "9:16")).toEqual({ width: 608, height: 1080 });
    expect(reframeDimensions(small, "1:1")).toEqual({ width: 1080, height: 1080 });
    expect(reframeDimensions(small, "4:5")).toEqual({ width: 864, height: 1080 });
  });

  it("always returns even pixel dimensions", () => {
    const aspects: SocialAspect[] = ["16:9", "9:16", "1:1", "4:5"];
    for (const aspect of aspects) {
      const { width, height } = reframeDimensions({ width: 1337, height: 743 }, aspect);
      expect(width % 2).toBe(0);
      expect(height % 2).toBe(0);
    }
  });
});

describe("reframe", () => {
  it("never mutates the master sequence", () => {
    const master = masterSequence();
    const snapshot = JSON.parse(JSON.stringify(master));
    reframe(master, "9:16", { id: "prop_seq_1", createdAt: "2026-07-22T00:00:00Z" });
    expect(master).toEqual(snapshot);
  });

  it("produces a proposal sequence with the target aspect's settings, distinct id from master", () => {
    const master = masterSequence();
    const ps = reframe(master, "9:16", { id: "prop_seq_1", createdAt: "2026-07-22T00:00:00Z" });
    expect(ps.id).not.toBe(master.id);
    expect(ps.masterSequenceId).toBe(master.id);
    expect(ps.sequence.settings.width).toBe(1080);
    expect(ps.sequence.settings.height).toBe(1920);
    // Non-dimension settings are preserved from the master.
    expect(ps.sequence.settings.frameRate).toEqual(master.settings.frameRate);
  });

  it.each<[SocialAspect, { width: number; height: number }]>([
    ["16:9", { width: 1920, height: 1080 }],
    ["9:16", { width: 1080, height: 1920 }],
    ["1:1", { width: 1920, height: 1920 }],
    ["4:5", { width: 1536, height: 1920 }],
  ])("yields correct target dimensions for %s", (aspect, expected) => {
    const master = masterSequence();
    const ps = reframe(master, aspect, { id: "prop_seq_1", createdAt: "2026-07-22T00:00:00Z" });
    expect(ps.sequence.settings.width).toBe(expected.width);
    expect(ps.sequence.settings.height).toBe(expected.height);
  });

  it("emits one reframe proposal per master object, each with a ReframeIntent descriptor", () => {
    const master = masterSequence();
    const ps = reframe(master, "9:16", { id: "prop_seq_1", createdAt: "2026-07-22T00:00:00Z" });
    expect(ps.proposals).toHaveLength(master.objects.length);
    for (const proposal of ps.proposals) {
      expect(proposal.kind).toBe("reframe");
      expect(proposal.status).toBe("pending");
      expect(["keep", "crop", "reposition"]).toContain(proposal.reframe?.intent);
      expect(proposal.reframe?.aspect).toBe("9:16");
    }
  });

  it("preserves source traceability back to the master sequence and each object's span", () => {
    const master = masterSequence();
    const ps = reframe(master, "1:1", { id: "prop_seq_1", createdAt: "2026-07-22T00:00:00Z" });
    for (let i = 0; i < master.objects.length; i++) {
      const masterObject = master.objects[i]!;
      const proposal = ps.proposals[i]!;
      expect(proposal.source.sequenceId).toBe(master.id);
      expect(proposal.source.startTicks).toBe(masterObject.startTicks);
      expect(proposal.source.endTicks).toBe(masterObject.startTicks + masterObject.durationTicks);
    }
  });

  it("does not pre-populate objects into the candidate sequence (they land only on accept)", () => {
    const master = masterSequence();
    const ps = reframe(master, "16:9", { id: "prop_seq_1", createdAt: "2026-07-22T00:00:00Z" });
    expect(ps.sequence.objects).toEqual([]);
  });

  it("assigns 'keep' when the target aspect matches the master's own aspect exactly", () => {
    const master = masterSequence(); // 1920x1080 == 16:9
    const ps = reframe(master, "16:9", { id: "prop_seq_1", createdAt: "2026-07-22T00:00:00Z" });
    expect(ps.proposals.every((p) => p.reframe?.intent === "keep")).toBe(true);
  });

  it("assigns 'reposition' when a landscape master targets a vertical aspect", () => {
    const master = masterSequence(); // 1920x1080 landscape
    const ps = reframe(master, "9:16", { id: "prop_seq_1", createdAt: "2026-07-22T00:00:00Z" });
    expect(ps.proposals.every((p) => p.reframe?.intent === "reposition")).toBe(true);
  });
});
