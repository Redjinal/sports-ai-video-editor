import { describe, expect, it } from "vitest";
import { asTicks } from "@sve/timeline-domain";
import { transcriptToCaptions } from "./caption-generation";
import type { Transcript } from "./transcript";

function wordsFrom(text: string, startTicks: number, endTicks: number) {
  const words = text.split(" ");
  const duration = endTicks - startTicks;
  return words.map((w, i) => ({
    text: w,
    startTicks: asTicks(startTicks + Math.round((i / words.length) * duration)),
    endTicks: asTicks(startTicks + Math.round(((i + 1) / words.length) * duration)),
  }));
}

describe("transcriptToCaptions", () => {
  it("respects maxCharsPerLine, wrapping onto additional lines", () => {
    const text = "the quick brown fox jumps over the lazy dog today";
    const transcript: Transcript = {
      speakers: [{ id: "sp-1", displayName: "Narrator" }],
      segments: [
        {
          id: "seg-1",
          speakerId: "sp-1",
          startTicks: asTicks(0),
          endTicks: asTicks(10_000),
          text,
          words: wordsFrom(text, 0, 10_000),
        },
      ],
    };
    const track = transcriptToCaptions(transcript, {
      maxCharsPerLine: 20,
      maxLines: 10,
      minDurationTicks: asTicks(0),
      maxDurationTicks: asTicks(1_000_000),
    });
    for (const cue of track.captions) {
      for (const line of cue.lines) {
        expect(line.length).toBeLessThanOrEqual(20);
      }
    }
    // All words must survive the chunking, in order.
    const rebuilt = track.captions.flatMap((c) => c.lines.flatMap((l) => l.split(" "))).join(" ");
    expect(rebuilt).toBe(text);
  });

  it("respects maxLines, starting a new cue instead of exceeding it", () => {
    const text = "one two three four five six seven eight nine ten eleven twelve";
    const transcript: Transcript = {
      speakers: [{ id: "sp-1", displayName: "Narrator" }],
      segments: [
        {
          id: "seg-1",
          speakerId: "sp-1",
          startTicks: asTicks(0),
          endTicks: asTicks(12_000),
          text,
          words: wordsFrom(text, 0, 12_000),
        },
      ],
    };
    const track = transcriptToCaptions(transcript, {
      maxCharsPerLine: 8,
      maxLines: 2,
      minDurationTicks: asTicks(0),
      maxDurationTicks: asTicks(1_000_000),
    });
    for (const cue of track.captions) {
      expect(cue.lines.length).toBeLessThanOrEqual(2);
    }
    expect(track.captions.length).toBeGreaterThan(1);
  });

  it("extends cues shorter than minDurationTicks without overlapping the next cue", () => {
    const transcript: Transcript = {
      speakers: [{ id: "sp-1", displayName: "Narrator" }],
      segments: [
        {
          id: "seg-1",
          speakerId: "sp-1",
          startTicks: asTicks(0),
          endTicks: asTicks(100),
          text: "hi",
          words: [{ text: "hi", startTicks: asTicks(0), endTicks: asTicks(100) }],
        },
        {
          id: "seg-2",
          speakerId: "sp-1",
          startTicks: asTicks(200),
          endTicks: asTicks(2_000),
          text: "there",
          words: [{ text: "there", startTicks: asTicks(200), endTicks: asTicks(2_000) }],
        },
      ],
    };
    const track = transcriptToCaptions(transcript, {
      maxCharsPerLine: 40,
      maxLines: 2,
      minDurationTicks: asTicks(1_000),
      maxDurationTicks: asTicks(1_000_000),
    });
    expect(track.captions).toHaveLength(2);
    const first = track.captions[0];
    const second = track.captions[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    // Extended to the min duration, but capped so it never overlaps the next cue.
    expect((first?.endTicks ?? 0) - (first?.startTicks ?? 0)).toBe(200);
    expect(first?.endTicks).toBe(second?.startTicks);
  });

  it("splits a long segment into multiple cues when it exceeds maxDurationTicks", () => {
    const text = "one two three four";
    const transcript: Transcript = {
      speakers: [{ id: "sp-1", displayName: "Narrator" }],
      segments: [
        {
          id: "seg-1",
          speakerId: "sp-1",
          startTicks: asTicks(0),
          endTicks: asTicks(40_000),
          text,
          words: wordsFrom(text, 0, 40_000),
        },
      ],
    };
    const track = transcriptToCaptions(transcript, {
      maxCharsPerLine: 40,
      maxLines: 4,
      minDurationTicks: asTicks(0),
      maxDurationTicks: asTicks(15_000),
    });
    expect(track.captions.length).toBeGreaterThan(1);
    for (const cue of track.captions) {
      expect(cue.endTicks - cue.startTicks).toBeLessThanOrEqual(15_000);
    }
  });

  it("is deterministic for identical input", () => {
    const text = "deterministic output every single time";
    const transcript: Transcript = {
      speakers: [{ id: "sp-1", displayName: "Narrator" }],
      segments: [
        {
          id: "seg-1",
          speakerId: "sp-1",
          startTicks: asTicks(0),
          endTicks: asTicks(5_000),
          text,
          words: wordsFrom(text, 0, 5_000),
        },
      ],
    };
    const opts = {
      maxCharsPerLine: 15,
      maxLines: 2,
      minDurationTicks: asTicks(500),
      maxDurationTicks: asTicks(5_000),
    };
    expect(transcriptToCaptions(transcript, opts)).toEqual(transcriptToCaptions(transcript, opts));
  });
});
