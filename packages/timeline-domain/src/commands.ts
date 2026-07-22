// Timeline commands (timeline-domain.md §12–15, §32–33).
// Every mutation is an atomic command with a deterministic inverse. apply is a pure
// function of (sequence, command): it never reads UI selection and never mutates input.
// A failing command throws and does not enter history.
import type { Sequence, SourceClip, TimelineObject } from "./model";
import { type Ticks, asTicks, endTicks, ZERO_TICKS } from "./ticks";

export interface CommandMeta {
  id: string;
  version: 1;
  sequenceId: string;
  /** ISO timestamp supplied by the caller so apply() stays deterministic. */
  timestamp: string;
  label?: string;
}

export interface AddObjectCommand {
  type: "AddObject";
  meta: CommandMeta;
  object: SourceClip;
}

export interface RemoveObjectCommand {
  type: "RemoveObject";
  meta: CommandMeta;
  objectId: string;
}

export type TrimEdge = "start" | "end";

export interface TrimObjectCommand {
  type: "TrimObject";
  meta: CommandMeta;
  objectId: string;
  edge: TrimEdge;
  /** Signed movement of the edge in timeline ticks. Positive lengthens the clip. */
  deltaTicks: number;
}

export interface MoveObjectCommand {
  type: "MoveObject";
  meta: CommandMeta;
  objectId: string;
  /** Destination track (may equal the current track). */
  toTrackId: string;
  /** New absolute start on the destination track. */
  toStartTicks: Ticks;
}

export interface SplitObjectCommand {
  type: "SplitObject";
  meta: CommandMeta;
  objectId: string;
  /** Split point; must lie strictly inside the object. */
  atTicks: Ticks;
  /** Id assigned to the new right-hand object. */
  newObjectId: string;
}

/**
 * Atomic group of commands (timeline-domain.md §34). Either every sub-command applies or
 * none do — a failure in any leaves the input sequence untouched. Its inverse is the
 * reversed list of sub-inverses, so undo of a batch is itself a batch.
 */
export interface BatchCommand {
  type: "Batch";
  meta: CommandMeta;
  commands: TimelineCommand[];
}

export type TimelineCommand =
  | AddObjectCommand
  | RemoveObjectCommand
  | TrimObjectCommand
  | MoveObjectCommand
  | SplitObjectCommand
  | BatchCommand;

export interface CommandContext {
  /** assetId -> total available source duration, for trim/add bounds checks. */
  assetBounds?: ReadonlyMap<string, Ticks>;
}

export interface CommandResult {
  sequence: Sequence;
  /** The command that exactly reverses this one (undo). */
  inverse: TimelineCommand;
}

export class CommandError extends Error {
  constructor(
    message: string,
    readonly code:
      | "TIMELINE_TRACK_NOT_FOUND"
      | "TIMELINE_OBJECT_EXISTS"
      | "TIMELINE_OBJECT_NOT_FOUND"
      | "TIMELINE_ZERO_DURATION"
      | "TIMELINE_SOURCE_OUT_OF_BOUNDS"
      | "TIMELINE_TRACK_LOCKED"
      | "TIMELINE_COLLISION"
      | "TIMELINE_SPLIT_OUT_OF_RANGE",
  ) {
    super(message);
    this.name = "CommandError";
  }
}

function requireClip(seq: Sequence, objectId: string): SourceClip {
  const obj = seq.objects.find((o) => o.id === objectId);
  if (!obj) {
    throw new CommandError(`Object ${objectId} not found`, "TIMELINE_OBJECT_NOT_FOUND");
  }
  return obj;
}

function requireTrack(seq: Sequence, trackId: string) {
  const track = seq.tracks.find((t) => t.id === trackId);
  if (!track) {
    throw new CommandError(`Track ${trackId} not found`, "TIMELINE_TRACK_NOT_FOUND");
  }
  return track;
}

/** Locked tracks are never mutated (timeline-domain.md §11, §18). */
function assertUnlocked(seq: Sequence, trackId: string): void {
  if (requireTrack(seq, trackId).locked) {
    throw new CommandError(`Track ${trackId} is locked`, "TIMELINE_TRACK_LOCKED");
  }
}

/** Two half-open intervals [s,e) overlap when each starts before the other ends. */
function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Reject an object occupying [start,end) on a track when it would overlap any existing
 * object except `ignoreId`. Moves cannot silently overwrite (timeline-domain.md §12).
 */
function assertNoCollision(
  seq: Sequence,
  trackId: string,
  start: Ticks,
  duration: Ticks,
  ignoreId: string,
): void {
  const end = endTicks(start, duration);
  for (const o of seq.objects) {
    if (o.id === ignoreId || o.trackId !== trackId) continue;
    if (intervalsOverlap(start, end, o.startTicks, endTicks(o.startTicks, o.durationTicks))) {
      throw new CommandError(
        `Object would overlap ${o.id} on track ${trackId}`,
        "TIMELINE_COLLISION",
      );
    }
  }
}

/** Source ticks consumed for a given (non-negative) timeline-duration at a playback rate. */
function sourceSpan(timelineTicks: Ticks, rate: SourceClip["playbackRate"]): Ticks {
  return asTicks(Math.round(timelineTicks * rate));
}

/** Signed source-tick delta for a signed timeline-tick delta (may be negative). */
function signedSourceDelta(timelineDelta: number, rate: SourceClip["playbackRate"]): number {
  return Math.round(timelineDelta * rate);
}

function replaceObject(seq: Sequence, next: TimelineObject): Sequence {
  return { ...seq, objects: seq.objects.map((o) => (o.id === next.id ? next : o)) };
}

function invertMeta(meta: CommandMeta, suffix: string): CommandMeta {
  return { ...meta, id: `${meta.id}:${suffix}` };
}

function applyAdd(seq: Sequence, cmd: AddObjectCommand, ctx: CommandContext): CommandResult {
  const { object } = cmd;
  if (!seq.tracks.some((t) => t.id === object.trackId)) {
    throw new CommandError(`Track ${object.trackId} not found`, "TIMELINE_TRACK_NOT_FOUND");
  }
  if (seq.objects.some((o) => o.id === object.id)) {
    throw new CommandError(`Object ${object.id} already exists`, "TIMELINE_OBJECT_EXISTS");
  }
  if (object.durationTicks <= ZERO_TICKS) {
    throw new CommandError("Object duration must be > 0", "TIMELINE_ZERO_DURATION");
  }
  const bounds = ctx.assetBounds?.get(object.assetId);
  if (bounds !== undefined) {
    const sourceEnd = endTicks(object.sourceInTicks, object.sourceDurationTicks);
    if (object.sourceInTicks < ZERO_TICKS || sourceEnd > bounds) {
      throw new CommandError(
        `Clip source range [${object.sourceInTicks}, ${sourceEnd}) exceeds asset bounds ${bounds}`,
        "TIMELINE_SOURCE_OUT_OF_BOUNDS",
      );
    }
  }
  const sequence: Sequence = { ...seq, objects: [...seq.objects, object] };
  const inverse: RemoveObjectCommand = {
    type: "RemoveObject",
    meta: invertMeta(cmd.meta, "inv"),
    objectId: object.id,
  };
  return { sequence, inverse };
}

function applyRemove(seq: Sequence, cmd: RemoveObjectCommand): CommandResult {
  const object = requireClip(seq, cmd.objectId);
  const sequence: Sequence = {
    ...seq,
    objects: seq.objects.filter((o) => o.id !== cmd.objectId),
  };
  const inverse: AddObjectCommand = {
    type: "AddObject",
    meta: invertMeta(cmd.meta, "inv"),
    object,
  };
  return { sequence, inverse };
}

function applyTrim(seq: Sequence, cmd: TrimObjectCommand, ctx: CommandContext): CommandResult {
  const clip = requireClip(seq, cmd.objectId);
  const delta = cmd.deltaTicks;
  let next: SourceClip;

  if (cmd.edge === "end") {
    // Standard trim of the tail: change duration; later objects do not move.
    const newDuration = asTicks(clip.durationTicks + delta);
    if (newDuration <= ZERO_TICKS) {
      throw new CommandError("Trim would zero the clip", "TIMELINE_ZERO_DURATION");
    }
    const newSourceDuration = sourceSpan(newDuration, clip.playbackRate);
    next = { ...clip, durationTicks: newDuration, sourceDurationTicks: newSourceDuration };
  } else {
    // Standard trim of the head: move start and in-point together; keep the tail fixed.
    const newStart = asTicks(clip.startTicks + delta);
    const newDuration = asTicks(clip.durationTicks - delta);
    if (newDuration <= ZERO_TICKS) {
      throw new CommandError("Trim would zero the clip", "TIMELINE_ZERO_DURATION");
    }
    const newSourceIn = asTicks(clip.sourceInTicks + signedSourceDelta(delta, clip.playbackRate));
    const newSourceDuration = sourceSpan(newDuration, clip.playbackRate);
    next = {
      ...clip,
      startTicks: newStart,
      durationTicks: newDuration,
      sourceInTicks: newSourceIn,
      sourceDurationTicks: newSourceDuration,
    };
  }

  const bounds = ctx.assetBounds?.get(clip.assetId);
  if (bounds !== undefined) {
    const sourceEnd = endTicks(next.sourceInTicks, next.sourceDurationTicks);
    if (next.sourceInTicks < ZERO_TICKS || sourceEnd > bounds) {
      throw new CommandError(
        `Trim exceeds asset source bounds ${bounds}`,
        "TIMELINE_SOURCE_OUT_OF_BOUNDS",
      );
    }
  }

  const sequence = replaceObject(seq, next);
  const inverse: TrimObjectCommand = {
    type: "TrimObject",
    meta: invertMeta(cmd.meta, "inv"),
    objectId: cmd.objectId,
    edge: cmd.edge,
    deltaTicks: -delta,
  };
  return { sequence, inverse };
}

function applyMove(seq: Sequence, cmd: MoveObjectCommand): CommandResult {
  const clip = requireClip(seq, cmd.objectId);
  assertUnlocked(seq, clip.trackId); // cannot move off a locked track
  assertUnlocked(seq, cmd.toTrackId); // cannot move onto a locked track
  assertNoCollision(seq, cmd.toTrackId, cmd.toStartTicks, clip.durationTicks, clip.id);

  const next: SourceClip = { ...clip, trackId: cmd.toTrackId, startTicks: cmd.toStartTicks };
  const inverse: MoveObjectCommand = {
    type: "MoveObject",
    meta: invertMeta(cmd.meta, "inv"),
    objectId: cmd.objectId,
    toTrackId: clip.trackId,
    toStartTicks: clip.startTicks,
  };
  return { sequence: replaceObject(seq, next), inverse };
}

function applySplit(seq: Sequence, cmd: SplitObjectCommand): CommandResult {
  const clip = requireClip(seq, cmd.objectId);
  assertUnlocked(seq, clip.trackId);
  if (seq.objects.some((o) => o.id === cmd.newObjectId)) {
    throw new CommandError(`Object ${cmd.newObjectId} already exists`, "TIMELINE_OBJECT_EXISTS");
  }
  const objEnd = endTicks(clip.startTicks, clip.durationTicks);
  if (cmd.atTicks <= clip.startTicks || cmd.atTicks >= objEnd) {
    throw new CommandError(
      `Split point ${cmd.atTicks} must lie strictly inside [${clip.startTicks}, ${objEnd})`,
      "TIMELINE_SPLIT_OUT_OF_RANGE",
    );
  }

  const leftDuration = asTicks(cmd.atTicks - clip.startTicks);
  const rightDuration = asTicks(objEnd - cmd.atTicks);
  // Source is partitioned continuously: the right part resumes where the left ends.
  const leftSourceDuration = sourceSpan(leftDuration, clip.playbackRate);
  const rightSourceDuration = asTicks(clip.sourceDurationTicks - leftSourceDuration);
  const rightSourceIn = asTicks(clip.sourceInTicks + leftSourceDuration);

  const left: SourceClip = {
    ...clip,
    durationTicks: leftDuration,
    sourceDurationTicks: leftSourceDuration,
  };
  const right: SourceClip = {
    ...clip,
    id: cmd.newObjectId,
    startTicks: cmd.atTicks,
    durationTicks: rightDuration,
    sourceInTicks: rightSourceIn,
    sourceDurationTicks: rightSourceDuration,
  };

  const sequence: Sequence = {
    ...seq,
    objects: [...seq.objects.map((o) => (o.id === clip.id ? left : o)), right],
  };

  // Undo: drop the right part and extend the left edge back over it.
  const inverse: BatchCommand = {
    type: "Batch",
    meta: invertMeta(cmd.meta, "inv"),
    commands: [
      { type: "RemoveObject", meta: invertMeta(cmd.meta, "inv-rm"), objectId: cmd.newObjectId },
      {
        type: "TrimObject",
        meta: invertMeta(cmd.meta, "inv-trim"),
        objectId: cmd.objectId,
        edge: "end",
        deltaTicks: rightDuration,
      },
    ],
  };
  return { sequence, inverse };
}

function applyBatch(seq: Sequence, cmd: BatchCommand, ctx: CommandContext): CommandResult {
  // Thread the sequence immutably; if any sub-command throws, nothing is committed.
  let working = seq;
  const inverses: TimelineCommand[] = [];
  for (const sub of cmd.commands) {
    const result = applyCommand(working, sub, ctx);
    working = result.sequence;
    inverses.push(result.inverse);
  }
  const inverse: BatchCommand = {
    type: "Batch",
    meta: invertMeta(cmd.meta, "inv"),
    commands: inverses.reverse(),
  };
  return { sequence: working, inverse };
}

/**
 * Apply a command to a sequence, returning the next sequence and the inverse command.
 * Pure and deterministic: the same (sequence, command) always yields the same result.
 */
export function applyCommand(
  seq: Sequence,
  cmd: TimelineCommand,
  ctx: CommandContext = {},
): CommandResult {
  switch (cmd.type) {
    case "AddObject":
      return applyAdd(seq, cmd, ctx);
    case "RemoveObject":
      return applyRemove(seq, cmd);
    case "TrimObject":
      return applyTrim(seq, cmd, ctx);
    case "MoveObject":
      return applyMove(seq, cmd);
    case "SplitObject":
      return applySplit(seq, cmd);
    case "Batch":
      return applyBatch(seq, cmd, ctx);
  }
}
