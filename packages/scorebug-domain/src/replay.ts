// Non-destructive replays: a replay is a fixed-rate view over a source range on an
// existing sequence, never a mutation of it (structure.md, DEC-EDIT-008 fixed rates).
import { z } from "zod";
import { asTicks, subTicks, type Ticks } from "@sve/timeline-domain";

/** Fixed replay rates permitted by DEC-EDIT-008. */
export const REPLAY_RATES = [0.25, 0.5, 1, 2] as const;

export const replayRateSchema = z.union([
  z.literal(0.25),
  z.literal(0.5),
  z.literal(1),
  z.literal(2),
]);
export type ReplayRate = (typeof REPLAY_RATES)[number];

export const audioModeSchema = z.enum(["mute", "full", "music"]);
export type AudioMode = z.infer<typeof audioModeSchema>;

export const replayBumperSchema = z.object({
  in: z.boolean(),
  out: z.boolean(),
  /** Optional bumper graphic/asset; when absent the flags alone drive playback. */
  assetId: z.string().min(1).optional(),
});
export type ReplayBumper = z.infer<typeof replayBumperSchema>;

export const DEFAULT_REPLAY_BUMPER: ReplayBumper = { in: false, out: false };

const tickSchema = z.number().int().nonnegative();

export const replaySpecSchema = z
  .object({
    id: z.string().min(1),
    sourceSequenceId: z.string().min(1),
    startTicks: tickSchema,
    endTicks: tickSchema,
    rate: replayRateSchema,
    bumper: replayBumperSchema,
    audioMode: audioModeSchema,
    /** Effective playback duration: (endTicks - startTicks) / rate, rounded to a tick. */
    durationTicks: tickSchema,
  })
  .refine((spec) => spec.endTicks > spec.startTicks, {
    message: "endTicks must be greater than startTicks",
    path: ["endTicks"],
  });

export interface ReplaySpec {
  id: string;
  sourceSequenceId: string;
  startTicks: Ticks;
  endTicks: Ticks;
  rate: ReplayRate;
  bumper: ReplayBumper;
  audioMode: AudioMode;
  durationTicks: Ticks;
}

/** Validate an untrusted replay spec payload (e.g. read from disk) at the boundary. */
export function parseReplaySpec(input: unknown): ReplaySpec {
  // zod verifies structure + integer-tick invariants; brand is reapplied by the cast,
  // mirroring @sve/timeline-domain's parseSequence.
  return replaySpecSchema.parse(input) as unknown as ReplaySpec;
}

export interface BuildReplayOptions {
  id: string;
  sourceSequenceId: string;
  startTicks: Ticks;
  endTicks: Ticks;
  rate: ReplayRate;
  bumper?: ReplayBumper;
  audioMode: AudioMode;
}

/**
 * Build a non-destructive `ReplaySpec` from a source range and a fixed rate.
 * The effective duration scales by 1/rate: a 2x replay of a 4s range plays in 2s;
 * a 0.5x replay of the same range plays in 8s.
 */
export function buildReplay(opts: BuildReplayOptions): ReplaySpec {
  if (opts.endTicks <= opts.startTicks) {
    throw new RangeError(
      `Replay source range must be non-empty: endTicks (${opts.endTicks}) must exceed startTicks (${opts.startTicks})`,
    );
  }
  const sourceDurationTicks = subTicks(opts.endTicks, opts.startTicks);
  const durationTicks = asTicks(Math.round(sourceDurationTicks / opts.rate));
  return {
    id: opts.id,
    sourceSequenceId: opts.sourceSequenceId,
    startTicks: opts.startTicks,
    endTicks: opts.endTicks,
    rate: opts.rate,
    bumper: opts.bumper ?? DEFAULT_REPLAY_BUMPER,
    audioMode: opts.audioMode,
    durationTicks,
  };
}

export interface NestedReplaySourceRange {
  startTicks: Ticks;
  endTicks: Ticks;
}

/**
 * Portable description of the nested replay sequence a replay implies. A later command
 * layer (application-services / timeline-domain commands) uses this to instantiate the
 * actual nested sequence + timeline object; this package never mutates a timeline itself.
 */
export interface NestedReplaySequenceDescriptor {
  kind: "nested_replay_sequence";
  replayId: string;
  sourceSequenceId: string;
  sourceRange: NestedReplaySourceRange;
  rate: ReplayRate;
  audioMode: AudioMode;
  bumper: ReplayBumper;
  durationTicks: Ticks;
}

/** Derive the portable nested-replay-sequence descriptor for an already-built replay. */
export function toNestedReplayDescriptor(spec: ReplaySpec): NestedReplaySequenceDescriptor {
  return {
    kind: "nested_replay_sequence",
    replayId: spec.id,
    sourceSequenceId: spec.sourceSequenceId,
    sourceRange: { startTicks: spec.startTicks, endTicks: spec.endTicks },
    rate: spec.rate,
    audioMode: spec.audioMode,
    bumper: spec.bumper,
    durationTicks: spec.durationTicks,
  };
}
