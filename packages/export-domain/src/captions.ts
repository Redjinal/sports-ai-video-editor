// Caption handling descriptors (roadmap.md M12: "Caption burn-in and sidecars"). This module
// only describes what a render/export job must produce for a given captions mode — it never
// renders caption text, lays out burn-in graphics, or writes a sidecar file itself.
import type { CaptionsMode } from "./settings";

export type SidecarCaptionFormat = "srt" | "vtt";

export interface SidecarDescriptor {
  format: SidecarCaptionFormat;
  /** Filename placed beside the output file, sharing its base name (media-engine.md Tier 1: SRT/VTT). */
  fileName: string;
}

/** Base name without its extension, e.g. "game_highlights.mp4" -> "game_highlights". */
function stripExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/** The sidecar file(s) expected beside an export output when `captions: 'sidecar'` is requested. */
export function sidecarDescriptorsFor(
  outputFileName: string,
  formats: readonly SidecarCaptionFormat[] = ["srt", "vtt"],
): SidecarDescriptor[] {
  const base = stripExtension(outputFileName);
  return formats.map((format) => ({ format, fileName: `${base}.${format}` }));
}

/** A flag the render pipeline must honor: compose captions directly into the video frames
 *  instead of (or in addition to) any sidecar. There is no separate caption track in the output. */
export interface BurnInInstruction {
  burnIn: true;
}

export const BURN_IN_INSTRUCTION: BurnInInstruction = { burnIn: true };

/** What a given captions mode requires of the export job — description only, no rendering. */
export type CaptionPlan =
  | { mode: "none" }
  | { mode: "burnIn"; instruction: BurnInInstruction }
  | { mode: "sidecar"; sidecars: SidecarDescriptor[] };

export function planCaptions(
  captions: CaptionsMode,
  outputFileName: string,
  sidecarFormats?: readonly SidecarCaptionFormat[],
): CaptionPlan {
  switch (captions) {
    case "none":
      return { mode: "none" };
    case "burnIn":
      return { mode: "burnIn", instruction: BURN_IN_INSTRUCTION };
    case "sidecar":
      return {
        mode: "sidecar",
        sidecars: sidecarDescriptorsFor(outputFileName, sidecarFormats ?? ["srt", "vtt"]),
      };
  }
}
