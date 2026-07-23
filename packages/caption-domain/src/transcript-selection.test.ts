import { describe, expect, it } from "vitest";
import { asTicks } from "@sve/timeline-domain";
import { ticksToRemoveForSegments, transcriptRangeToTicks } from "./transcript-selection";
import type { Transcript } from "./transcript";
import { TranscriptError } from "./errors";

const transcript: Transcript = {
  speakers: [{ id: "sp-1", displayName: "Coach" }],
  segments: [
    { id: "a", speakerId: "sp-1", startTicks: asTicks(0), endTicks: asTicks(1_000), text: "a" },
    { id: "b", speakerId: "sp-1", startTicks: asTicks(1_000), endTicks: asTicks(2_000), text: "b" },
    { id: "c", speakerId: "sp-1", startTicks: asTicks(2_000), endTicks: asTicks(3_000), text: "c" },
    // A gap between c and d.
    { id: "d", speakerId: "sp-1", startTicks: asTicks(5_000), endTicks: asTicks(6_000), text: "d" },
  ],
};

describe("transcriptRangeToTicks", () => {
  it("maps a contiguous id selection to the spanning tick range", () => {
    expect(transcriptRangeToTicks(transcript, ["a", "b"])).toEqual({
      startTicks: asTicks(0),
      endTicks: asTicks(2_000),
    });
  });

  it("maps a from/to segment range to the spanning tick range, inclusive", () => {
    expect(transcriptRangeToTicks(transcript, { fromSegmentId: "b", toSegmentId: "d" })).toEqual({
      startTicks: asTicks(1_000),
      endTicks: asTicks(6_000),
    });
  });

  it("is order-independent for from/to", () => {
    expect(transcriptRangeToTicks(transcript, { fromSegmentId: "d", toSegmentId: "b" })).toEqual(
      transcriptRangeToTicks(transcript, { fromSegmentId: "b", toSegmentId: "d" }),
    );
  });

  it("maps a non-contiguous selection to the min/max spanning range, including the gap", () => {
    expect(transcriptRangeToTicks(transcript, ["a", "d"])).toEqual({
      startTicks: asTicks(0),
      endTicks: asTicks(6_000),
    });
  });

  it("throws on an empty selection", () => {
    expect(() => transcriptRangeToTicks(transcript, [])).toThrow(TranscriptError);
  });

  it("throws on an unknown segment id", () => {
    expect(() => transcriptRangeToTicks(transcript, ["nope"])).toThrow(TranscriptError);
  });
});

describe("ticksToRemoveForSegments", () => {
  it("merges adjacent selected segments into a single removal range", () => {
    expect(ticksToRemoveForSegments(transcript, ["a", "b", "c"])).toEqual([
      { startTicks: asTicks(0), endTicks: asTicks(3_000) },
    ]);
  });

  it("keeps a gap between non-adjacent selected segments as separate removal ranges", () => {
    expect(ticksToRemoveForSegments(transcript, ["a", "d"])).toEqual([
      { startTicks: asTicks(0), endTicks: asTicks(1_000) },
      { startTicks: asTicks(5_000), endTicks: asTicks(6_000) },
    ]);
  });

  it("does not remove an unselected segment's time even when it sits between selected ones", () => {
    // "b" (1000..2000) is not selected, so it must remain as an untouched gap between the
    // two removal ranges for "a" and "c".
    expect(ticksToRemoveForSegments(transcript, ["a", "c"])).toEqual([
      { startTicks: asTicks(0), endTicks: asTicks(1_000) },
      { startTicks: asTicks(2_000), endTicks: asTicks(3_000) },
    ]);
  });
});
