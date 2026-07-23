import { describe, expect, it } from "vitest";
import { asTicks } from "@sve/timeline-domain";
import { searchTranscript } from "./transcript-search";
import type { Transcript } from "./transcript";

const transcript: Transcript = {
  speakers: [{ id: "sp-1", displayName: "Coach" }],
  segments: [
    {
      id: "seg-1",
      speakerId: "sp-1",
      startTicks: asTicks(0),
      endTicks: asTicks(1_000),
      text: "Great defense on that possession",
    },
    {
      id: "seg-2",
      speakerId: "sp-1",
      startTicks: asTicks(1_000),
      endTicks: asTicks(2_000),
      text: "Defense defense defense wins games",
    },
    {
      id: "seg-3",
      speakerId: "sp-1",
      startTicks: asTicks(2_000),
      endTicks: asTicks(3_000),
      text: "Nothing relevant here",
    },
  ],
};

describe("searchTranscript", () => {
  it("finds case-insensitive matches across segments", () => {
    const results = searchTranscript(transcript, "defense");
    expect(results.map((r) => r.segmentId)).toEqual(["seg-1", "seg-2"]);
    expect(results[0]?.matchRanges).toEqual([{ start: 6, end: 13 }]);
  });

  it("finds multiple non-overlapping matches within a single segment", () => {
    const results = searchTranscript(transcript, "defense");
    const seg2 = results.find((r) => r.segmentId === "seg-2");
    expect(seg2?.matchRanges).toEqual([
      { start: 0, end: 7 },
      { start: 8, end: 15 },
      { start: 16, end: 23 },
    ]);
  });

  it("returns no results for a query that doesn't appear anywhere", () => {
    expect(searchTranscript(transcript, "touchdown")).toEqual([]);
  });

  it("returns no results for an empty query", () => {
    expect(searchTranscript(transcript, "")).toEqual([]);
  });

  it("is deterministic across repeated calls", () => {
    expect(searchTranscript(transcript, "Defense")).toEqual(
      searchTranscript(transcript, "defense"),
    );
  });
});
