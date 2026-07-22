// Timeline structural model (timeline-domain.md §5–9).
// Objects use the [start, start+duration) half-open interval in integer ticks.
import type { Ticks, RationalRate } from "./ticks";

export type TrackType = "video" | "audio" | "text" | "caption" | "graphic" | "multicam" | "marker";

export interface SequenceSettings {
  width: number;
  height: number;
  pixelAspectRatio: RationalRate;
  frameRate: RationalRate;
  audioSampleRate: number;
  /** Solid background colour behind transparent tracks, as #rrggbb. */
  background: string;
  /** Display only; does not affect authoritative tick time. */
  timeDisplayMode: "timecode" | "seconds" | "frames";
}

export interface Track {
  id: string;
  name: string;
  type: TrackType;
  /** Vertical stacking order; higher composites above lower for video. */
  order: number;
  height: number;
  color: string;
  locked: boolean;
  hidden: boolean;
  muted: boolean;
  solo: boolean;
  /** Whether new edits target this track. */
  editTargeted: boolean;
  rippleGroupId?: string;
}

export interface TimelineObjectBase {
  id: string;
  trackId: string;
  startTicks: Ticks;
  durationTicks: Ticks;
  enabled: boolean;
  name?: string;
  /** Objects sharing a link group move/trim together unless overridden. */
  linkGroupId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Fields shared by any object that maps a timeline span onto a range of an underlying source
 * (an asset clip or a nested sequence). Editing commands operate on this shape, so move / trim
 * / split are identical for both object kinds.
 */
export interface RangedObject extends TimelineObjectBase {
  /** In-point within the source, in source ticks. */
  sourceInTicks: Ticks;
  /** Consumed source duration; with rate 1 this equals durationTicks. */
  sourceDurationTicks: Ticks;
  /** Fixed Phase-1 speeds only (DEC-EDIT-008). */
  playbackRate: 0.25 | 0.5 | 1 | 2;
}

/** A clip that references a range of a source asset (timeline-domain.md §9). */
export interface SourceClip extends RangedObject {
  kind: "clip";
  assetId: string;
}

/** An instance of another sequence placed on the timeline (timeline-domain.md §8, DEC-EDIT-005). */
export interface NestedSequenceObject extends RangedObject {
  kind: "nested";
  /** Id of the child sequence this instance renders. */
  sequenceId: string;
}

export type TimelineObject = SourceClip | NestedSequenceObject;

export interface Marker {
  id: string;
  atTicks: Ticks;
  label: string;
  color?: string;
}

export interface Sequence {
  id: string;
  name: string;
  settings: SequenceSettings;
  tracks: Track[];
  objects: TimelineObject[];
  markers: Marker[];
  basketballContextId?: string;
  parentSequenceIds: string[];
}

/** Total source length available for a clip's asset, used for trim bounds. */
export interface AssetSourceBounds {
  assetId: string;
  sourceDurationTicks: Ticks;
}
