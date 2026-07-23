import { describe, expect, it } from "vitest";
import { parseVtt, serializeVtt } from "./vtt";
import { parseSrtTimecode, parseVttTimecode } from "./timecode";
import { CaptionFormatError } from "./errors";

const SAMPLE_VTT = [
  "WEBVTT",
  "",
  "1",
  "00:00:01.000 --> 00:00:04.000",
  "Hello world",
  "",
  "00:00:05.500 --> 00:00:07.250",
  "No identifier cue",
  "with two lines",
  "",
].join("\n");

describe("WebVTT import/export", () => {
  it("parses cues with correct timing and lines, with and without a cue identifier", () => {
    const track = parseVtt(SAMPLE_VTT);
    expect(track.captions).toHaveLength(2);
    expect(track.captions[0]?.lines).toEqual(["Hello world"]);
    expect(track.captions[1]?.lines).toEqual(["No identifier cue", "with two lines"]);
  });

  it("round-trips losslessly: parse -> serialize -> parse is equal", () => {
    const first = parseVtt(SAMPLE_VTT);
    const second = parseVtt(serializeVtt(first));
    expect(second).toEqual(first);
  });

  it("round-trips an empty track", () => {
    const empty = parseVtt("WEBVTT\n");
    expect(parseVtt(serializeVtt(empty))).toEqual(empty);
  });

  it("requires a WEBVTT header", () => {
    expect(() => parseVtt("1\n00:00:01.000 --> 00:00:04.000\nHello\n")).toThrow(CaptionFormatError);
  });

  it("throws a structured CaptionFormatError on a malformed timecode", () => {
    const bad = "WEBVTT\n\nnot-a-timecode\nHello\n";
    try {
      parseVtt(bad);
      throw new Error("expected parseVtt to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(CaptionFormatError);
      expect((err as CaptionFormatError).code).toBe("invalid-timecode");
    }
  });

  it("throws when a cue has no text lines", () => {
    const bad = "WEBVTT\n\n00:00:01.000 --> 00:00:04.000\n";
    expect(() => parseVtt(bad)).toThrow(CaptionFormatError);
  });
});

describe("SRT <-> VTT timecode precision", () => {
  it("00:00:01,500 (SRT) and 00:00:01.500 (VTT) map to the same ticks", () => {
    expect(parseSrtTimecode("00:00:01,500")).toBe(parseVttTimecode("00:00:01.500"));
  });

  it("captions converted from SRT to VTT keep exact timing", () => {
    const srtLikeVtt = ["WEBVTT", "", "00:00:12.345 --> 00:00:15.678", "Precise timing", ""].join(
      "\n",
    );
    const track = parseVtt(srtLikeVtt);
    expect(track.captions[0]?.startTicks).toBe(parseSrtTimecode("00:00:12,345"));
    expect(track.captions[0]?.endTicks).toBe(parseSrtTimecode("00:00:15,678"));
  });
});
