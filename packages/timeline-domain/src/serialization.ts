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
};

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

const timelineObjectSchema = z.discriminatedUnion("kind", [
  sourceClipSchema,
  nestedSequenceObjectSchema,
  transitionObjectSchema,
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
