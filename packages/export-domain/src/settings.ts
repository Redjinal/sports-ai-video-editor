// Export settings requested for an output file (media-engine.md §4, roadmap.md M12).
// Platform-neutral: describes what should be produced, never how to produce it.
import { z } from "zod";
import type { RationalRate } from "@sve/timeline-domain";

export const CONTAINER = "mp4" as const;
export const containerSchema = z.literal(CONTAINER);
export type Container = z.infer<typeof containerSchema>;

export const videoCodecSchema = z.enum(["h264", "h265"]);
export type VideoCodec = z.infer<typeof videoCodecSchema>;

export const AUDIO_CODEC = "aac" as const;
export const audioCodecSchema = z.literal(AUDIO_CODEC);
export type AudioCodec = z.infer<typeof audioCodecSchema>;

export const resolutionSchema = z.enum(["720p", "1080p", "1440p", "4k"]);
export type Resolution = z.infer<typeof resolutionSchema>;

export interface Dimensions {
  width: number;
  height: number;
}

/** Resolution label -> pixel dimensions (media-engine.md §4 export matrix). */
export const RESOLUTION_DIMENSIONS: Readonly<Record<Resolution, Dimensions>> = {
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
  "1440p": { width: 2560, height: 1440 },
  "4k": { width: 3840, height: 2160 },
};

/** Ordered smallest -> largest; used to find the nearest supported tier for a platform. */
export const RESOLUTIONS_BY_SIZE: readonly Resolution[] = ["720p", "1080p", "1440p", "4k"];

/** Map a resolution label to its pixel dimensions. */
export function resolutionToDimensions(resolution: Resolution): Dimensions {
  return RESOLUTION_DIMENSIONS[resolution];
}

const rationalRateSchema = z.object({
  numerator: z.number().int().positive(),
  denominator: z.number().int().positive(),
});

/** A frame rate, either a plain number (30) or an exact rational (30000/1001 for 29.97). */
export const fpsSchema = z.union([z.number().positive(), rationalRateSchema]);
export type Fps = number | RationalRate;

/** Resolve an Fps value to a plain number for comparison/display. */
export function fpsToNumber(fps: Fps): number {
  return typeof fps === "number" ? fps : fps.numerator / fps.denominator;
}

export const hwAccelSchema = z.enum(["auto", "hardware", "software"]);
export type HwAccel = z.infer<typeof hwAccelSchema>;

export const captionsModeSchema = z.enum(["none", "burnIn", "sidecar"]);
export type CaptionsMode = z.infer<typeof captionsModeSchema>;

const tickSchema = z.number().int().nonnegative();

/** An optional partial/test export range, in timeline ticks (half-open [start, end)). */
export const testRangeSchema = z
  .object({
    startTicks: tickSchema,
    endTicks: tickSchema,
  })
  .refine((range) => range.endTicks > range.startTicks, {
    message: "testRange.endTicks must be greater than startTicks",
  });
export type TestRange = z.infer<typeof testRangeSchema>;

export const exportSettingsSchema = z.object({
  container: containerSchema,
  videoCodec: videoCodecSchema,
  audioCodec: audioCodecSchema,
  resolution: resolutionSchema,
  fps: fpsSchema,
  hwAccel: hwAccelSchema,
  captions: captionsModeSchema,
  /** When present, export only this ticks range instead of the full sequence (a "test export"). */
  testRange: testRangeSchema.optional(),
});
export type ExportSettings = z.infer<typeof exportSettingsSchema>;

/** Validate untrusted export settings (e.g. read from a saved job or a UI form). */
export function parseExportSettings(input: unknown): ExportSettings {
  return exportSettingsSchema.parse(input);
}
