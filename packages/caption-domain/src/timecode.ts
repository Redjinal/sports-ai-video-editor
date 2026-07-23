// SRT/VTT timecode <-> ticks conversion.
//
// TIMESCALE is 27,000,000 ticks/second, which is exactly divisible by 1000, so
// ticks-per-millisecond (27,000) is an *exact* integer — converting ms -> ticks -> ms is
// lossless for any millisecond value, which is what SRT/VTT round-tripping depends on.
import { asTicks, TIMESCALE, type Ticks } from "@sve/timeline-domain";
import { CaptionFormatError } from "./errors";

export const TICKS_PER_MS = TIMESCALE / 1000;

/** Convert whole milliseconds (as used by SRT/VTT timecodes) to ticks, exactly. */
export function msToTicks(ms: number): Ticks {
  if (!Number.isFinite(ms) || ms < 0) {
    throw new RangeError(`milliseconds must be a non-negative finite number, got ${ms}`);
  }
  return asTicks(Math.round(ms) * TICKS_PER_MS);
}

/** Convert ticks to whole milliseconds for display/serialization. Exact for ticks produced by
 *  msToTicks; rounds defensively for any other tick value. */
export function ticksToMs(t: Ticks): number {
  return Math.round(t / TICKS_PER_MS);
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

interface TimeParts {
  hours: number;
  minutes: number;
  seconds: number;
  millis: number;
}

function msToParts(totalMs: number): TimeParts {
  const millis = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  return { hours, minutes, seconds, millis };
}

function partsToMs(parts: TimeParts): number {
  return ((parts.hours * 60 + parts.minutes) * 60 + parts.seconds) * 1000 + parts.millis;
}

const SRT_TIMECODE_RE = /^(\d{2,}):(\d{2}):(\d{2}),(\d{3})$/;

/** Parse an SRT timecode, e.g. "00:00:01,500". */
export function parseSrtTimecode(raw: string): Ticks {
  const trimmed = raw.trim();
  const match = SRT_TIMECODE_RE.exec(trimmed);
  if (!match) {
    throw new CaptionFormatError("invalid-timecode", `Invalid SRT timecode: "${raw}"`);
  }
  const [, hh, mm, ss, mmm] = match as unknown as [string, string, string, string, string];
  return msToTicks(
    partsToMs({ hours: Number(hh), minutes: Number(mm), seconds: Number(ss), millis: Number(mmm) }),
  );
}

/** Serialize ticks to an SRT timecode, e.g. "00:00:01,500". */
export function serializeSrtTimecode(t: Ticks): string {
  const parts = msToParts(ticksToMs(t));
  return `${pad(parts.hours, 2)}:${pad(parts.minutes, 2)}:${pad(parts.seconds, 2)},${pad(parts.millis, 3)}`;
}

// WebVTT allows the hour component to be omitted (MM:SS.mmm), unlike SRT.
const VTT_TIMECODE_RE = /^(?:(\d{2,}):)?(\d{2}):(\d{2})\.(\d{3})$/;

/** Parse a WebVTT timecode, e.g. "00:00:01.500" or "00:01.500". */
export function parseVttTimecode(raw: string): Ticks {
  const trimmed = raw.trim();
  const match = VTT_TIMECODE_RE.exec(trimmed);
  if (!match) {
    throw new CaptionFormatError("invalid-timecode", `Invalid VTT timecode: "${raw}"`);
  }
  const [, hh, mm, ss, mmm] = match as unknown as [
    string,
    string | undefined,
    string,
    string,
    string,
  ];
  return msToTicks(
    partsToMs({
      hours: hh === undefined ? 0 : Number(hh),
      minutes: Number(mm),
      seconds: Number(ss),
      millis: Number(mmm),
    }),
  );
}

/** Serialize ticks to a WebVTT timecode, e.g. "00:00:01.500". Always includes the hour component
 *  for unambiguous round-tripping. */
export function serializeVttTimecode(t: Ticks): string {
  const parts = msToParts(ticksToMs(t));
  return `${pad(parts.hours, 2)}:${pad(parts.minutes, 2)}:${pad(parts.seconds, 2)}.${pad(parts.millis, 3)}`;
}
