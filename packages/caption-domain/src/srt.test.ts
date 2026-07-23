import { describe, expect, it } from "vitest";
import { parseSrt, serializeSrt } from "./srt";
import { CaptionFormatError } from "./errors";

const SAMPLE_SRT = [
  "1",
  "00:00:01,000 --> 00:00:04,000",
  "Hello world",
  "",
  "2",
  "00:00:05,500 --> 00:00:07,250",
  "Second cue",
  "with two lines",
  "",
].join("\n");

describe("SRT import/export", () => {
  it("parses cues with correct timing and lines", () => {
    const track = parseSrt(SAMPLE_SRT);
    expect(track.captions).toHaveLength(2);
    expect(track.captions[0]?.lines).toEqual(["Hello world"]);
    expect(track.captions[1]?.lines).toEqual(["Second cue", "with two lines"]);
  });

  it("round-trips losslessly: parse -> serialize -> parse is equal", () => {
    const first = parseSrt(SAMPLE_SRT);
    const second = parseSrt(serializeSrt(first));
    expect(second).toEqual(first);
  });

  it("round-trips an empty track", () => {
    const empty = parseSrt("");
    expect(parseSrt(serializeSrt(empty))).toEqual(empty);
  });

  it("preserves millisecond-precision timing across a round trip", () => {
    const track = parseSrt(SAMPLE_SRT);
    const again = parseSrt(serializeSrt(track));
    expect(again.captions[1]?.startTicks).toBe(track.captions[1]?.startTicks);
    expect(again.captions[1]?.endTicks).toBe(track.captions[1]?.endTicks);
  });

  it("throws a structured CaptionFormatError on a malformed cue index", () => {
    const bad = "x\n00:00:01,000 --> 00:00:04,000\nHello\n";
    expect(() => parseSrt(bad)).toThrow(CaptionFormatError);
    try {
      parseSrt(bad);
      throw new Error("expected parseSrt to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(CaptionFormatError);
      expect((err as CaptionFormatError).code).toBe("invalid-cue-index");
    }
  });

  it("throws a structured CaptionFormatError on a malformed timecode", () => {
    const bad = "1\nnot-a-timecode\nHello\n";
    expect(() => parseSrt(bad)).toThrow(CaptionFormatError);
  });

  it("throws when the cue end is not after the start", () => {
    const bad = "1\n00:00:05,000 --> 00:00:02,000\nHello\n";
    expect(() => parseSrt(bad)).toThrow(CaptionFormatError);
  });

  it("throws when a cue has no text lines", () => {
    const bad = "1\n00:00:01,000 --> 00:00:04,000\n";
    expect(() => parseSrt(bad)).toThrow(CaptionFormatError);
  });
});
