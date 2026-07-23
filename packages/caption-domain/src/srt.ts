// SubRip (.srt) import/export. Round-trips losslessly for well-formed input: parse -> serialize
// -> parse yields an equal CaptionTrack (captions get positional ids, stable across a round trip).
import { DEFAULT_CAPTION_STYLE, type Caption, type CaptionTrack } from "./caption";
import { CaptionFormatError } from "./errors";
import { parseSrtTimecode, serializeSrtTimecode } from "./timecode";

const ARROW = "-->";

function normalizeNewlines(input: string): string {
  return input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/** Parse SubRip text into a CaptionTrack. Throws CaptionFormatError on malformed input. */
export function parseSrt(input: string, trackId = "captions"): CaptionTrack {
  const blocks = normalizeNewlines(input)
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  const captions: Caption[] = [];
  for (const block of blocks) {
    const lines = block.split("\n");
    const indexLine = lines[0];
    if (indexLine === undefined || !/^\d+$/.test(indexLine.trim())) {
      throw new CaptionFormatError(
        "invalid-cue-index",
        `Malformed SRT cue index: ${JSON.stringify(indexLine ?? "")}`,
      );
    }
    const timecodeLine = lines[1];
    if (timecodeLine === undefined) {
      throw new CaptionFormatError(
        "invalid-cue-block",
        `SRT cue ${indexLine} is missing a timecode line`,
      );
    }
    const arrowIdx = timecodeLine.indexOf(ARROW);
    if (arrowIdx === -1) {
      throw new CaptionFormatError(
        "invalid-timecode",
        `Malformed SRT timecode line: "${timecodeLine}"`,
      );
    }
    const startRaw = timecodeLine.slice(0, arrowIdx).trim();
    const endToken = timecodeLine
      .slice(arrowIdx + ARROW.length)
      .trim()
      .split(/\s+/)[0];
    const startTicks = parseSrtTimecode(startRaw);
    const endTicks = parseSrtTimecode(endToken ?? "");
    if (endTicks <= startTicks) {
      throw new CaptionFormatError(
        "invalid-cue-order",
        `SRT cue ${indexLine} end must be after start: "${timecodeLine}"`,
      );
    }

    const textLines = lines.slice(2);
    if (textLines.length === 0) {
      throw new CaptionFormatError("empty-cue-text", `SRT cue ${indexLine} has no text lines`);
    }

    captions.push({ id: `srt-${captions.length + 1}`, startTicks, endTicks, lines: textLines });
  }

  return { id: trackId, captions, defaultStyle: DEFAULT_CAPTION_STYLE };
}

/** Serialize a CaptionTrack to SubRip text. Cues are renumbered sequentially from 1. */
export function serializeSrt(track: CaptionTrack): string {
  const body = track.captions
    .map((cue, i) => {
      const header = `${i + 1}\n${serializeSrtTimecode(cue.startTicks)} ${ARROW} ${serializeSrtTimecode(cue.endTicks)}`;
      return `${header}\n${cue.lines.join("\n")}`;
    })
    .join("\n\n");
  return body.length > 0 ? `${body}\n` : "";
}
