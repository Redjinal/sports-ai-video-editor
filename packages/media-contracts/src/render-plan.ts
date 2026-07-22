// Render plan contract (media-engine.md §13). The render plan is the immutable,
// fully-resolved instruction set an export executes. Preview is never the render plan.
import { z } from "zod";
import { rationalSchema } from "./inspect";

export const videoOutputSettingsSchema = z.object({
  codec: z.enum(["h264", "h265"]),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  frameRate: rationalSchema,
  /** Prefer hardware encode when available, with high-quality software fallback (DEC-PLAT-004). */
  preferHardware: z.boolean().default(true),
  /** Constant-quality target (e.g. CRF-like). Encoder-neutral 0..100, higher = better. */
  quality: z.number().int().min(0).max(100).default(70),
});
export type VideoOutputSettings = z.infer<typeof videoOutputSettingsSchema>;

export const audioOutputSettingsSchema = z.object({
  codec: z.literal("aac"),
  sampleRate: z.number().int().positive(),
  channels: z.number().int().positive(),
  bitrateKbps: z.number().int().positive().default(192),
});
export type AudioOutputSettings = z.infer<typeof audioOutputSettingsSchema>;

/** Fixed Phase-1 playback speeds (DEC-EDIT-008). No speed ramps. */
export const playbackRateSchema = z.union([
  z.literal(0.25),
  z.literal(0.5),
  z.literal(1),
  z.literal(2),
]);
export type PlaybackRate = z.infer<typeof playbackRateSchema>;

export const renderClipSchema = z.object({
  assetId: z.string().min(1),
  /** Resolved absolute path (original, managed, or proxy per sourcePolicy). */
  sourcePath: z.string().min(1),
  sourceInTicks: z.number().int().nonnegative(),
  sourceDurationTicks: z.number().int().positive(),
  timelineStartTicks: z.number().int().nonnegative(),
  timelineDurationTicks: z.number().int().positive(),
  playbackRate: playbackRateSchema.default(1),
});
export type RenderClip = z.infer<typeof renderClipSchema>;

export const renderTrackSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["video", "audio"]),
  /** Lower renders first; higher composites on top. */
  order: z.number().int(),
  clips: z.array(renderClipSchema),
});
export type RenderTrack = z.infer<typeof renderTrackSchema>;

// Overlays and captions are modelled but empty in the M1 slice.
export const renderOverlaySchema = z.object({
  id: z.string().min(1),
  kind: z.string(),
});
export type RenderOverlay = z.infer<typeof renderOverlaySchema>;

export const renderCaptionPlanSchema = z.object({
  entries: z.array(z.unknown()).default([]),
});
export type RenderCaptionPlan = z.infer<typeof renderCaptionPlanSchema>;

export const sourcePolicySchema = z.enum(["originals", "allow-managed", "allow-proxies"]);
export type SourcePolicy = z.infer<typeof sourcePolicySchema>;

export const renderPlanSchema = z.object({
  version: z.literal(1),
  sequenceId: z.string().min(1),
  range: z.object({
    startTicks: z.number().int().nonnegative(),
    endTicks: z.number().int().nonnegative(),
  }),
  video: videoOutputSettingsSchema,
  audio: audioOutputSettingsSchema,
  tracks: z.array(renderTrackSchema),
  overlays: z.array(renderOverlaySchema).default([]),
  captions: renderCaptionPlanSchema.default({ entries: [] }),
  /** Final export uses originals by default (media-engine.md §8). */
  sourcePolicy: sourcePolicySchema.default("originals"),
});
export type RenderPlan = z.infer<typeof renderPlanSchema>;

/** Validate a render plan before handing it to an encoder (EXPORT_INVALID_PLAN). */
export function validateRenderPlan(input: unknown): RenderPlan {
  const plan = renderPlanSchema.parse(input);
  if (plan.range.endTicks <= plan.range.startTicks) {
    throw new Error("RenderPlan range end must be after start");
  }
  return plan;
}
