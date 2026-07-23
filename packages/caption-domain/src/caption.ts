// Caption model: styled subtitle/caption cues on an ordered track.
// Platform-neutral — this is a render *description*, not a renderer (see burn-in.ts).
import { z } from "zod";
import type { Ticks } from "@sve/timeline-domain";

export const captionVerticalPositionSchema = z.enum(["top", "bottom"]);
export type CaptionVerticalPosition = z.infer<typeof captionVerticalPositionSchema>;

export const captionAlignmentSchema = z.enum(["left", "center", "right"]);
export type CaptionAlignment = z.infer<typeof captionAlignmentSchema>;

export interface CaptionStyle {
  fontFamily: string;
  fontSizePx: number;
  /** Text colour, e.g. "#ffffff" or "#ffffffcc". */
  color: string;
  /** Box/background colour behind the text; absent means no background. */
  backgroundColor?: string;
  boxEnabled: boolean;
  position: CaptionVerticalPosition;
  alignment: CaptionAlignment;
}

export const captionStyleSchema = z.object({
  fontFamily: z.string().min(1),
  fontSizePx: z.number().positive(),
  color: z.string().min(1),
  backgroundColor: z.string().min(1).optional(),
  boxEnabled: z.boolean(),
  position: captionVerticalPositionSchema,
  alignment: captionAlignmentSchema,
});

/** A sensible, provider-neutral default style — plain readable captions. */
export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontFamily: "sans-serif",
  fontSizePx: 32,
  color: "#ffffff",
  boxEnabled: true,
  backgroundColor: "#000000a0",
  position: "bottom",
  alignment: "center",
};

export interface Caption {
  id: string;
  startTicks: Ticks;
  endTicks: Ticks;
  /** One entry per displayed line, top to bottom. */
  lines: string[];
  /** Per-cue style override; falls back to the owning track's defaultStyle when absent. */
  style?: CaptionStyle;
}

const tickSchema = z.number().int().nonnegative();

export const captionSchema = z
  .object({
    id: z.string().min(1),
    startTicks: tickSchema,
    endTicks: tickSchema,
    lines: z.array(z.string()).min(1),
    style: captionStyleSchema.optional(),
  })
  .refine((c) => c.endTicks > c.startTicks, "Caption endTicks must be > startTicks");

export interface CaptionTrack {
  id: string;
  captions: Caption[];
  defaultStyle: CaptionStyle;
}

export const captionTrackSchema = z.object({
  id: z.string().min(1),
  captions: z.array(captionSchema),
  defaultStyle: captionStyleSchema,
});

/** Validate an untrusted caption track payload into a typed CaptionTrack (branded ticks). */
export function parseCaptionTrack(input: unknown): CaptionTrack {
  return captionTrackSchema.parse(input) as unknown as CaptionTrack;
}
