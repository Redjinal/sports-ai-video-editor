// Serialization schemas for persistence (timeline-domain.md §32 "Serialization").
// Runtime-validate at the persistence boundary; authoritative time stays integer ticks.
import { z } from "zod";
import type { Sequence } from "./model";

const tickSchema = z.number().int().nonnegative();
const rationalSchema = z.object({
  numerator: z.number().int(),
  denominator: z.number().int().positive(),
});

const sequenceSettingsSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  pixelAspectRatio: rationalSchema,
  frameRate: rationalSchema,
  audioSampleRate: z.number().int().positive(),
  background: z.string(),
  timeDisplayMode: z.enum(["timecode", "seconds", "frames"]),
});

const trackSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: z.enum(["video", "audio", "text", "caption", "graphic", "multicam", "marker"]),
  order: z.number().int(),
  height: z.number().int().positive(),
  color: z.string(),
  locked: z.boolean(),
  hidden: z.boolean(),
  muted: z.boolean(),
  solo: z.boolean(),
  editTargeted: z.boolean(),
  rippleGroupId: z.string().optional(),
});

const keyframeSchema = z.object({
  atTicks: tickSchema,
  value: z.number(),
  interp: z.enum(["linear", "hold", "ease"]),
});
const animatableSchema = z.union([z.number(), z.object({ keyframes: z.array(keyframeSchema) })]);
const transformSchema = z.object({
  x: animatableSchema,
  y: animatableSchema,
  scale: animatableSchema,
  rotation: animatableSchema,
  opacity: animatableSchema,
  anchorX: z.number(),
  anchorY: z.number(),
  cropTop: z.number(),
  cropRight: z.number(),
  cropBottom: z.number(),
  cropLeft: z.number(),
  flipH: z.boolean(),
  flipV: z.boolean(),
  fit: z.enum(["fit", "fill", "stretch"]),
});

const rangedFields = {
  id: z.string().min(1),
  trackId: z.string().min(1),
  startTicks: tickSchema,
  durationTicks: tickSchema.refine((n) => n > 0, "durationTicks must be > 0"),
  enabled: z.boolean(),
  name: z.string().optional(),
  linkGroupId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  sourceInTicks: tickSchema,
  sourceDurationTicks: tickSchema.refine((n) => n > 0, "sourceDurationTicks must be > 0"),
  playbackRate: z.union([z.literal(0.25), z.literal(0.5), z.literal(1), z.literal(2)]),
  transform: transformSchema.optional(),
};

const textStyleSchema = z.object({
  fontFamily: z.string(),
  fontSizePx: z.number(),
  color: z.string(),
  weight: z.number(),
  align: z.enum(["left", "center", "right"]),
  backgroundColor: z.string().optional(),
});

const graphicSpecSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("shape"),
    shape: z.enum(["rectangle", "ellipse"]),
    fill: z.string(),
    stroke: z.string().optional(),
    radius: z.number().optional(),
  }),
  z.object({ type: z.literal("image"), assetId: z.string() }),
  z.object({ type: z.literal("logo"), assetId: z.string() }),
  z.object({ type: z.literal("progress"), value: z.number(), fill: z.string(), track: z.string() }),
  z.object({ type: z.literal("waveform"), assetId: z.string(), color: z.string() }),
  z.object({
    type: z.literal("lowerThird"),
    title: z.string(),
    subtitle: z.string(),
    accent: z.string(),
  }),
]);

const sourceClipSchema = z.object({
  ...rangedFields,
  kind: z.literal("clip"),
  assetId: z.string().min(1),
});

const nestedSequenceObjectSchema = z.object({
  ...rangedFields,
  kind: z.literal("nested"),
  sequenceId: z.string().min(1),
});

const textObjectSchema = z.object({
  ...rangedFields,
  kind: z.literal("text"),
  text: z.string(),
  style: textStyleSchema,
});

const graphicObjectSchema = z.object({
  ...rangedFields,
  kind: z.literal("graphic"),
  graphic: graphicSpecSchema,
});

const transitionSpecSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("crossDissolve") }),
  z.object({ type: z.literal("dip"), color: z.string() }),
  z.object({
    type: z.literal("fade"),
    color: z.string(),
    direction: z.enum(["in", "out"]),
  }),
  z.object({
    type: z.literal("wipe"),
    angleDegrees: z.number(),
    softnessPx: z.number().nonnegative(),
  }),
]);

const transitionObjectSchema = z.object({
  ...rangedFields,
  kind: z.literal("transition"),
  transition: transitionSpecSchema,
  fromId: z.string().optional(),
  toId: z.string().optional(),
});

const multicamAngleSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().min(1),
  offsetTicks: tickSchema,
  label: z.string(),
  timecodeStartTicks: tickSchema.optional(),
});

const multicamObjectSchema = z.object({
  ...rangedFields,
  kind: z.literal("multicam"),
  angles: z.array(multicamAngleSchema),
  switches: z.array(z.object({ atTicks: tickSchema, angleId: z.string().min(1) })),
  audioAngleId: z.string(),
  lockedAngleIds: z.array(z.string()),
});

const timelineObjectSchema = z.discriminatedUnion("kind", [
  sourceClipSchema,
  nestedSequenceObjectSchema,
  textObjectSchema,
  graphicObjectSchema,
  transitionObjectSchema,
  multicamObjectSchema,
]);

const markerSchema = z.object({
  id: z.string().min(1),
  atTicks: tickSchema,
  label: z.string(),
  color: z.string().optional(),
});

export const sequenceSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  settings: sequenceSettingsSchema,
  tracks: z.array(trackSchema),
  objects: z.array(timelineObjectSchema),
  markers: z.array(markerSchema),
  basketballContextId: z.string().optional(),
  parentSequenceIds: z.array(z.string()),
});

/** Validate an untrusted sequence payload into a typed Sequence (branded ticks). */
export function parseSequence(input: unknown): Sequence {
  // zod verifies structure + integer-tick invariants; brand is reapplied by the cast.
  return sequenceSchema.parse(input) as unknown as Sequence;
}

/** Serialize a sequence to a plain JSON-safe value (ticks are already numbers). */
export function serializeSequence(seq: Sequence): unknown {
  return JSON.parse(JSON.stringify(seq));
}
