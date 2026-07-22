// Snapping (timeline-domain.md §17). Pure resolver: given a candidate time and a threshold,
// return the nearest snap target, or null. The UI decides whether snapping is enabled and which
// categories are active; this module only computes the geometry.
import { type Ticks, asTicks } from "./ticks";
import type { Sequence } from "./model";

export type SnapTargetType =
  "clip-start" | "clip-end" | "sequence-start" | "sequence-end" | "playhead" | "marker";

export interface SnapResult {
  targetType: SnapTargetType;
  targetId?: string;
  originalTime: Ticks;
  snappedTime: Ticks;
  /** Absolute tick distance moved to snap. */
  distance: number;
}

export interface SnapOptions {
  thresholdTicks: number;
  /** Restrict to these categories; omitted means all. */
  categories?: SnapTargetType[];
  /** Current playhead position, if the playhead is a snap target. */
  playheadTicks?: Ticks;
  /** Object ids to ignore (e.g. the object being dragged). */
  ignoreObjectIds?: string[];
  /** Sequence total duration, for the sequence-end target. */
  sequenceEndTicks?: Ticks;
}

interface Candidate {
  type: SnapTargetType;
  id?: string;
  time: Ticks;
}

function collectCandidates(seq: Sequence, opts: SnapOptions): Candidate[] {
  const ignore = new Set(opts.ignoreObjectIds ?? []);
  const wants = (t: SnapTargetType) => !opts.categories || opts.categories.includes(t);
  const out: Candidate[] = [];

  if (wants("sequence-start")) out.push({ type: "sequence-start", time: asTicks(0) });
  if (wants("sequence-end") && opts.sequenceEndTicks !== undefined) {
    out.push({ type: "sequence-end", time: opts.sequenceEndTicks });
  }
  if (wants("playhead") && opts.playheadTicks !== undefined) {
    out.push({ type: "playhead", time: opts.playheadTicks });
  }
  for (const o of seq.objects) {
    if (ignore.has(o.id)) continue;
    if (wants("clip-start")) out.push({ type: "clip-start", id: o.id, time: o.startTicks });
    if (wants("clip-end")) {
      out.push({ type: "clip-end", id: o.id, time: asTicks(o.startTicks + o.durationTicks) });
    }
  }
  for (const m of seq.markers) {
    if (wants("marker")) out.push({ type: "marker", id: m.id, time: m.atTicks });
  }
  return out;
}

/**
 * Snap `time` to the nearest candidate within `thresholdTicks`, or return null if none is close
 * enough. Ties resolve to the smaller time for determinism.
 */
export function resolveSnap(seq: Sequence, time: Ticks, opts: SnapOptions): SnapResult | null {
  let best: { candidate: Candidate; distance: number } | null = null;
  for (const candidate of collectCandidates(seq, opts)) {
    const distance = Math.abs(candidate.time - time);
    if (distance > opts.thresholdTicks) continue;
    if (
      best === null ||
      distance < best.distance ||
      (distance === best.distance && candidate.time < best.candidate.time)
    ) {
      best = { candidate, distance };
    }
  }
  if (!best) return null;
  return best.candidate.id !== undefined
    ? {
        targetType: best.candidate.type,
        targetId: best.candidate.id,
        originalTime: time,
        snappedTime: best.candidate.time,
        distance: best.distance,
      }
    : {
        targetType: best.candidate.type,
        originalTime: time,
        snappedTime: best.candidate.time,
        distance: best.distance,
      };
}
