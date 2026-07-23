// Shared test fixtures. Not exported from index.ts — internal to this package's own test suite.
import { asTicks, type Sequence, type SourceClip, type Track } from "@sve/timeline-domain";

export function track(id: string, order: number): Track {
  return {
    id,
    name: id,
    type: "video",
    order,
    height: 64,
    color: "#334155",
    locked: false,
    hidden: false,
    muted: false,
    solo: false,
    editTargeted: true,
  };
}

export function clip(id: string, trackId: string, start: number, duration: number): SourceClip {
  return {
    kind: "clip",
    id,
    trackId,
    startTicks: asTicks(start),
    durationTicks: asTicks(duration),
    enabled: true,
    assetId: "ast_1",
    sourceInTicks: asTicks(0),
    sourceDurationTicks: asTicks(duration),
    playbackRate: 1,
  };
}

/** A simple 1920x1080/30fps master sequence with two clips on one video track. */
export function masterSequence(): Sequence {
  return {
    id: "seq_master",
    name: "Master",
    settings: {
      width: 1920,
      height: 1080,
      pixelAspectRatio: { numerator: 1, denominator: 1 },
      frameRate: { numerator: 30, denominator: 1 },
      audioSampleRate: 48_000,
      background: "#000000",
      timeDisplayMode: "timecode",
    },
    tracks: [track("trk_v1", 0)],
    objects: [clip("clp_1", "trk_v1", 0, 900_000), clip("clp_2", "trk_v1", 900_000, 900_000)],
    markers: [{ id: "mk_1", atTicks: asTicks(0), label: "Start" }],
    parentSequenceIds: [],
  };
}
