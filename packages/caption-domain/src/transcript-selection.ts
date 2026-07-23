// Transcript-driven timeline selection: map chosen transcript segments to a tick range (or
// ranges), the basis for "select clip by transcript" and manual transcript-driven deletion.
import { asTicks, type Ticks } from "@sve/timeline-domain";
import { TranscriptError } from "./errors";
import type { Transcript } from "./transcript";

export interface TickRange {
  startTicks: Ticks;
  endTicks: Ticks;
}

/** Either an explicit, order-independent set of segment ids, or a first/last pair naming a
 *  contiguous run in transcript order (inclusive on both ends). */
export type TranscriptSelection = string[] | { fromSegmentId: string; toSegmentId: string };

function resolveSelectionIds(transcript: Transcript, selection: TranscriptSelection): string[] {
  if (Array.isArray(selection)) {
    if (selection.length === 0) {
      throw new TranscriptError("invalid-selection", "Selection must include at least one segment");
    }
    return selection;
  }
  const order = transcript.segments.map((s) => s.id);
  const fromIndex = order.indexOf(selection.fromSegmentId);
  const toIndex = order.indexOf(selection.toSegmentId);
  if (fromIndex === -1) {
    throw new TranscriptError(
      "segment-not-found",
      `Segment "${selection.fromSegmentId}" not found`,
    );
  }
  if (toIndex === -1) {
    throw new TranscriptError("segment-not-found", `Segment "${selection.toSegmentId}" not found`);
  }
  const [lo, hi]: [number, number] =
    fromIndex <= toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex];
  return order.slice(lo, hi + 1);
}

function selectedSegmentsInOrder(transcript: Transcript, selection: TranscriptSelection) {
  const ids = new Set(resolveSelectionIds(transcript, selection));
  const segments = transcript.segments.filter((s) => ids.has(s.id));
  if (segments.length !== ids.size) {
    const missing = [...ids].find((id) => !segments.some((s) => s.id === id));
    throw new TranscriptError("segment-not-found", `Segment "${missing}" not found`);
  }
  return segments;
}

/** The single overall tick range spanning every selected segment (min start .. max end) — the
 *  basis for "select clip by transcript". Selected segments need not be contiguous; gaps between
 *  them are included in the resulting range. */
export function transcriptRangeToTicks(
  transcript: Transcript,
  selection: TranscriptSelection,
): TickRange {
  const segments = selectedSegmentsInOrder(transcript, selection);
  const startTicks = segments.reduce((min, s) => Math.min(min, s.startTicks), Infinity);
  const endTicks = segments.reduce((max, s) => Math.max(max, s.endTicks), -Infinity);
  return { startTicks: asTicks(startTicks), endTicks: asTicks(endTicks) };
}

/**
 * The minimal set of contiguous tick ranges covering exactly the selected segments — for
 * transcript-driven deletion. Adjacent/overlapping selected segments are merged into a single
 * range; gaps left by *unselected* segments are preserved (not removed).
 */
export function ticksToRemoveForSegments(
  transcript: Transcript,
  selection: TranscriptSelection,
): TickRange[] {
  const segments = selectedSegmentsInOrder(transcript, selection)
    .slice()
    .sort((a, b) => a.startTicks - b.startTicks);
  const ranges: TickRange[] = [];
  for (const segment of segments) {
    const last = ranges[ranges.length - 1];
    if (last && segment.startTicks <= last.endTicks) {
      // Touches or overlaps the previous range — extend it instead of starting a new one.
      if (segment.endTicks > last.endTicks) {
        ranges[ranges.length - 1] = { startTicks: last.startTicks, endTicks: segment.endTicks };
      }
    } else {
      ranges.push({ startTicks: segment.startTicks, endTicks: segment.endTicks });
    }
  }
  return ranges;
}
