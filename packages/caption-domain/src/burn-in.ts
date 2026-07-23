// Caption burn-in descriptor: a pure, provider-neutral render *description* that a later media
// adapter (FFmpeg/Media3) can consume. No rendering, frame access, or I/O happens here.
import type { Ticks } from "@sve/timeline-domain";
import type { CaptionStyle, CaptionTrack } from "./caption";

export interface CaptionBurnInCue {
  startTicks: Ticks;
  endTicks: Ticks;
  lines: string[];
  /** Resolved style: the cue's own override merged over the track default. */
  style: CaptionStyle;
}

/** A full render plan for burning one caption track into video frames. */
export interface CaptionBurnInSpec {
  trackId: string;
  cues: CaptionBurnInCue[];
}

/** Build a burn-in spec from a caption track, resolving each cue's effective style. Pure — no
 *  rendering, no I/O; a later media adapter turns this into actual pixels. */
export function buildCaptionBurnInSpec(track: CaptionTrack): CaptionBurnInSpec {
  return {
    trackId: track.id,
    cues: track.captions.map((cue) => ({
      startTicks: cue.startTicks,
      endTicks: cue.endTicks,
      lines: cue.lines,
      style: cue.style ?? track.defaultStyle,
    })),
  };
}
