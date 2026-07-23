import { describe, expect, it } from "vitest";
import { asTicks } from "@sve/timeline-domain";
import {
  editSegmentText,
  mergeSegments,
  reassignSpeaker,
  renameSpeaker,
  splitSegment,
} from "./transcript-operations";
import { transcriptIsWellOrdered, type Transcript } from "./transcript";
import { TranscriptError } from "./errors";

function baseTranscript(): Transcript {
  return {
    speakers: [
      { id: "sp-1", displayName: "Coach" },
      { id: "sp-2", displayName: "Analyst" },
    ],
    segments: [
      {
        id: "seg-1",
        speakerId: "sp-1",
        startTicks: asTicks(0),
        endTicks: asTicks(4_000),
        text: "one two three four",
        words: [
          { text: "one", startTicks: asTicks(0), endTicks: asTicks(900) },
          { text: "two", startTicks: asTicks(1_000), endTicks: asTicks(1_900) },
          { text: "three", startTicks: asTicks(2_000), endTicks: asTicks(2_900) },
          { text: "four", startTicks: asTicks(3_000), endTicks: asTicks(4_000) },
        ],
      },
      {
        id: "seg-2",
        speakerId: "sp-1",
        startTicks: asTicks(4_000),
        endTicks: asTicks(6_000),
        text: "five six",
      },
    ],
  };
}

describe("editSegmentText", () => {
  it("replaces a segment's text and leaves timing untouched", () => {
    const t = baseTranscript();
    const updated = editSegmentText(t, "seg-2", "corrected text");
    expect(updated.segments[1]?.text).toBe("corrected text");
    expect(updated.segments[1]?.startTicks).toBe(t.segments[1]?.startTicks);
    expect(updated.segments[1]?.endTicks).toBe(t.segments[1]?.endTicks);
    // Pure: original is untouched.
    expect(t.segments[1]?.text).toBe("five six");
  });

  it("throws on an unknown segment id", () => {
    expect(() => editSegmentText(baseTranscript(), "nope", "x")).toThrow(TranscriptError);
  });
});

describe("splitSegment", () => {
  it("splits at a word boundary, producing a sorted, non-overlapping transcript", () => {
    const t = baseTranscript();
    const result = splitSegment(t, "seg-1", asTicks(2_000), "seg-1b");
    expect(result.segments).toHaveLength(3);
    expect(result.segments[0]?.id).toBe("seg-1");
    expect(result.segments[0]?.text).toBe("one two");
    expect(result.segments[0]?.endTicks).toBe(asTicks(2_000));
    expect(result.segments[1]?.id).toBe("seg-1b");
    expect(result.segments[1]?.text).toBe("three four");
    expect(result.segments[1]?.startTicks).toBe(asTicks(2_000));
    expect(result.segments[1]?.endTicks).toBe(asTicks(4_000));
    expect(transcriptIsWellOrdered(result)).toBe(true);
  });

  it("splits proportionally when there is no word timing", () => {
    const t = baseTranscript();
    // seg-2 spans 4000..6000 with text "five six"; split near the midpoint.
    const result = splitSegment(t, "seg-2", asTicks(5_000), "seg-2b");
    const [left, right] = result.segments.slice(1);
    expect(left?.text).toBe("five");
    expect(right?.text).toBe("six");
    expect(left?.endTicks).toBe(asTicks(5_000));
    expect(right?.startTicks).toBe(asTicks(5_000));
    expect(transcriptIsWellOrdered(result)).toBe(true);
  });

  it("rejects a split point outside the segment", () => {
    const t = baseTranscript();
    expect(() => splitSegment(t, "seg-1", asTicks(0), "x")).toThrow(TranscriptError);
    expect(() => splitSegment(t, "seg-1", asTicks(4_000), "x")).toThrow(TranscriptError);
  });

  it("rejects a tick split point that doesn't align with a word boundary", () => {
    const t = baseTranscript();
    expect(() => splitSegment(t, "seg-1", asTicks(1_500), "x")).toThrow(TranscriptError);
  });
});

describe("mergeSegments", () => {
  it("merges two adjacent segments into one contiguous segment", () => {
    const t = baseTranscript();
    const split = splitSegment(t, "seg-1", asTicks(2_000), "seg-1b");
    const merged = mergeSegments(split, "seg-1", "seg-1b");
    expect(merged.segments).toHaveLength(2);
    expect(merged.segments[0]?.id).toBe("seg-1");
    expect(merged.segments[0]?.startTicks).toBe(asTicks(0));
    expect(merged.segments[0]?.endTicks).toBe(asTicks(4_000));
    expect(merged.segments[0]?.text).toBe("one two three four");
    expect(transcriptIsWellOrdered(merged)).toBe(true);
  });

  it("rejects merging non-adjacent segments", () => {
    const t = baseTranscript();
    const split = splitSegment(t, "seg-1", asTicks(2_000), "seg-1b");
    expect(() => mergeSegments(split, "seg-1", "seg-2")).toThrow(TranscriptError);
  });
});

describe("reassignSpeaker", () => {
  it("changes a segment's speaker", () => {
    const t = baseTranscript();
    const updated = reassignSpeaker(t, "seg-1", "sp-2");
    expect(updated.segments[0]?.speakerId).toBe("sp-2");
    expect(t.segments[0]?.speakerId).toBe("sp-1");
  });

  it("rejects an unknown speaker id", () => {
    expect(() => reassignSpeaker(baseTranscript(), "seg-1", "nope")).toThrow(TranscriptError);
  });
});

describe("renameSpeaker", () => {
  it("renames a speaker without touching segment references", () => {
    const t = baseTranscript();
    const updated = renameSpeaker(t, "sp-1", "Head Coach");
    expect(updated.speakers.find((s) => s.id === "sp-1")?.displayName).toBe("Head Coach");
    expect(updated.segments[0]?.speakerId).toBe("sp-1");
  });

  it("rejects an unknown speaker id", () => {
    expect(() => renameSpeaker(baseTranscript(), "nope", "X")).toThrow(TranscriptError);
  });
});
