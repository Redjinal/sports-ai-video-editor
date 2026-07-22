// Media inspection contract (technical-architecture.md §12, media-engine.md §5).
// The result crosses the native IPC boundary from FFprobe and is therefore untrusted:
// it MUST be validated with these zod schemas before use (engineering-standards.md §2).
import { z } from "zod";

export const PROTOCOL_VERSION = 1 as const;

/** Rational value (frame rate, pixel aspect ratio). Never rounded to an integer. */
export const rationalSchema = z.object({
  numerator: z.number().int(),
  denominator: z.number().int().positive(),
});
export type Rational = z.infer<typeof rationalSchema>;

/** Compatibility tier for an inspected asset (media-engine.md §5, product S-04). */
export const compatibilityTierSchema = z.enum([
  "certified",
  "conditional",
  "best_effort",
  "unsupported",
]);
export type CompatibilityTier = z.infer<typeof compatibilityTierSchema>;

export const mediaWarningSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(["info", "warning"]).default("warning"),
});
export type MediaWarning = z.infer<typeof mediaWarningSchema>;

export const videoStreamInfoSchema = z.object({
  index: z.number().int().nonnegative(),
  codec: z.string(),
  profile: z.string().optional(),
  level: z.number().optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  pixelAspectRatio: rationalSchema,
  /** Average frame rate over the file. */
  avgFrameRate: rationalSchema,
  /** Base (nominal) frame rate. */
  rFrameRate: rationalSchema,
  /** True when the source is variable-frame-rate; nominal fps is then not source truth. */
  isVariableFrameRate: z.boolean(),
  colorPrimaries: z.string().optional(),
  colorTransfer: z.string().optional(),
  colorSpace: z.string().optional(),
  /** Display-matrix rotation in degrees, if present. */
  rotationDegrees: z.number().optional(),
  bitDepth: z.number().int().positive().optional(),
});
export type VideoStreamInfo = z.infer<typeof videoStreamInfoSchema>;

export const audioStreamInfoSchema = z.object({
  index: z.number().int().nonnegative(),
  codec: z.string(),
  sampleRate: z.number().int().positive(),
  channels: z.number().int().positive(),
  channelLayout: z.string().optional(),
  language: z.string().optional(),
});
export type AudioStreamInfo = z.infer<typeof audioStreamInfoSchema>;

export const otherStreamInfoSchema = z.object({
  index: z.number().int().nonnegative(),
  kind: z.enum(["subtitle", "data"]),
  codec: z.string().optional(),
  language: z.string().optional(),
});
export type OtherStreamInfo = z.infer<typeof otherStreamInfoSchema>;

/** Request DTO (versioned, correlated). */
export const inspectMediaRequestSchema = z.object({
  protocolVersion: z.literal(PROTOCOL_VERSION),
  requestId: z.string().min(1),
  path: z.string().min(1),
});
export type InspectMediaRequestV1 = z.infer<typeof inspectMediaRequestSchema>;

/** Normalised inspection result. Durations are integer ticks at 27,000,000/s. */
export const inspectMediaResultSchema = z.object({
  requestId: z.string().min(1),
  /** Stable content fingerprint for asset identity across relink/proxy. */
  assetFingerprint: z.string().min(1),
  container: z.string(),
  durationTicks: z.number().int().nonnegative(),
  startTicks: z.number().int().default(0),
  fileSizeBytes: z.number().int().nonnegative(),
  videoStreams: z.array(videoStreamInfoSchema),
  audioStreams: z.array(audioStreamInfoSchema),
  otherStreams: z.array(otherStreamInfoSchema).default([]),
  compatibility: compatibilityTierSchema,
  /** Embedded timecode, if any. */
  timecode: z.string().optional(),
  warnings: z.array(mediaWarningSchema).default([]),
});
export type InspectMediaResultV1 = z.infer<typeof inspectMediaResultSchema>;

/**
 * Validate an untrusted inspection payload (e.g. parsed from ffprobe JSON) into a
 * typed result. Throws a ZodError on malformed input — callers convert it to a
 * MEDIA_INSPECT_FAILED MediaEngineError at the boundary.
 */
export function parseInspectResult(input: unknown): InspectMediaResultV1 {
  return inspectMediaResultSchema.parse(input);
}
