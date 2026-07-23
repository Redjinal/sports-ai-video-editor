// WebVTT (.vtt) import/export. Round-trips losslessly for well-formed input: parse -> serialize
// -> parse yields an equal CaptionTrack (captions get positional ids, stable across a round trip).
import { DEFAULT_CAPTION_STYLE, type Caption, type CaptionTrack } from "./caption";
import { CaptionFormatError } from "./errors";
import { parseVttTimecode, serializeVttTimecode } from "./timecode";

const ARROW = "-->";
const HEADER = "WEBVTT";

function normalizeNewlines(input: string): string {
  // Strip a leading UTF-8 BOM if present (avoided as a regex literal to keep the source free of
  // invisible/irregular whitespace characters).
  const withoutBom = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  return withoutBom.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/** Parse WebVTT text into a CaptionTrack. Throws CaptionFormatError on malformed input. NOTE and
 *  STYLE blocks are not supported — this is a captions-content parser, not a full VTT engine. */
export function parseVtt(input: string, trackId = "captions"): CaptionTrack {
  const blocks = normalizeNewlines(input)
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  const header = blocks[0];
  if (header === undefined || !header.startsWith(HEADER)) {
    throw new CaptionFormatError(
      "missing-header",
      `VTT input must start with a "${HEADER}" header`,
    );
  }

  const captions: Caption[] = [];
  for (const block of blocks.slice(1)) {
    const lines = block.split("\n");
    const first = lines[0];
    if (first === undefined) continue;
    // An optional cue identifier line precedes the timecode line when present.
    const cursor = first.includes(ARROW) ? 0 : 1;
    const timecodeLine = lines[cursor];
    if (timecodeLine === undefined) {
      throw new CaptionFormatError(
        "invalid-cue-block",
        `Malformed VTT cue block: ${JSON.stringify(block)}`,
      );
    }
    const arrowIdx = timecodeLine.indexOf(ARROW);
    if (arrowIdx === -1) {
      throw new CaptionFormatError(
        "invalid-timecode",
        `Malformed VTT timecode line: "${timecodeLine}"`,
      );
    }
    const startRaw = timecodeLine.slice(0, arrowIdx).trim();
    const endToken = timecodeLine
      .slice(arrowIdx + ARROW.length)
      .trim()
      .split(/\s+/)[0];
    const startTicks = parseVttTimecode(startRaw);
    const endTicks = parseVttTimecode(endToken ?? "");
    if (endTicks <= startTicks) {
      throw new CaptionFormatError(
        "invalid-cue-order",
        `VTT cue end must be after start: "${timecodeLine}"`,
      );
    }

    const textLines = lines.slice(cursor + 1);
    if (textLines.length === 0) {
      throw new CaptionFormatError(
        "empty-cue-text",
        `VTT cue has no text lines: ${JSON.stringify(block)}`,
      );
    }

    captions.push({ id: `vtt-${captions.length + 1}`, startTicks, endTicks, lines: textLines });
  }

  return { id: trackId, captions, defaultStyle: DEFAULT_CAPTION_STYLE };
}

/** Serialize a CaptionTrack to WebVTT text. */
export function serializeVtt(track: CaptionTrack): string {
  const body = track.captions
    .map(
      (cue) =>
        `${serializeVttTimecode(cue.startTicks)} ${ARROW} ${serializeVttTimecode(cue.endTicks)}\n${cue.lines.join("\n")}`,
    )
    .join("\n\n");
  return body.length > 0 ? `${HEADER}\n\n${body}\n` : `${HEADER}\n`;
}
