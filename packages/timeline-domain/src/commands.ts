// Timeline commands (timeline-domain.md §12–15, §32–33).
// Every mutation is an atomic command with a deterministic inverse. apply is a pure
// function of (sequence, command): it never reads UI selection and never mutates input.
// A failing command throws and does not enter history.
import type {
  GraphicSpec,
  Marker,
  MulticamAngle,
  MulticamSwitch,
  Sequence,
  TextStyle,
  TimelineObject,
  TransitionObject,
  TransitionSpec,
} from "./model";
import type { Transform } from "./transform";
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
  object: TimelineObject;
}

export interface RemoveObjectCommand {
  type: "RemoveObject";
  meta: CommandMeta;
  objectId: string;
}

/**
 * Replace the blend recipe of a transition object in place (DEC-EDIT-007). Only the
 * `transition` field changes; span/track are edited through the ranged commands. The inverse
 * restores the prior spec exactly, so undo is deterministic.
 */
export interface SetTransitionCommand {
  type: "SetTransition";
  meta: CommandMeta;
  objectId: string;
  transition: TransitionSpec;
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
 * Shift a set of objects by a signed tick delta on their current tracks. The primitive that
 * ripple/insert operations build on: the whole set moves together, so their internal spacing
 * is preserved, and the moved block is collision-checked against objects NOT in the set.
 */
export interface ShiftObjectsCommand {
  type: "ShiftObjects";
  meta: CommandMeta;
  objectIds: string[];
  deltaTicks: number;
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

/** Toggleable track flags (timeline-domain.md §18). Lock is enforced by edit commands. */
export type TrackFlag = "locked" | "hidden" | "muted" | "solo";

export interface SetTrackFlagCommand {
  type: "SetTrackFlag";
  meta: CommandMeta;
  trackId: string;
  flag: TrackFlag;
  value: boolean;
}

export interface AddMarkerCommand {
  type: "AddMarker";
  meta: CommandMeta;
  marker: Marker;
}

export interface RemoveMarkerCommand {
  type: "RemoveMarker";
  meta: CommandMeta;
  markerId: string;
}

export interface MoveMarkerCommand {
  type: "MoveMarker";
  meta: CommandMeta;
  markerId: string;
  toTicks: Ticks;
}

/**
 * Replace an object's visual transform (M5). The UI computes the whole transform — including
 * keyframe edits — and dispatches it here; `undefined` clears back to identity. Fully reversible.
 */
export interface SetTransformCommand {
  type: "SetTransform";
  meta: CommandMeta;
  objectId: string;
  transform: Transform | undefined;
}

/** Edit a text object's content and style (M5). Reversible. */
export interface SetTextCommand {
  type: "SetText";
  meta: CommandMeta;
  objectId: string;
  text: string;
  style: TextStyle;
}

/** Edit a graphic object's specification (M5). Reversible. */
export interface SetGraphicCommand {
  type: "SetGraphic";
  meta: CommandMeta;
  objectId: string;
  graphic: GraphicSpec;
}

/**
 * Replace a multicam object's editable program — angles (with sync offsets), switch points,
 * audio angle, and angle locks — atomically (M7). Every non-destructive multicam edit (live
 * switch, switch-point move, active-angle replacement, sync, lock) flows through this one
 * reversible command, mirroring how the UI edits transforms/graphics.
 */
export interface SetMulticamCommand {
  type: "SetMulticam";
  meta: CommandMeta;
  objectId: string;
  angles: MulticamAngle[];
  switches: MulticamSwitch[];
  audioAngleId: string;
  lockedAngleIds: string[];
}

export type TimelineCommand =
  | AddObjectCommand
  | RemoveObjectCommand
  | SetTransitionCommand
  | TrimObjectCommand
  | MoveObjectCommand
  | SplitObjectCommand
  | ShiftObjectsCommand
  | SetTrackFlagCommand
  | AddMarkerCommand
  | RemoveMarkerCommand
  | MoveMarkerCommand
  | SetTransformCommand
  | SetTextCommand
  | SetGraphicCommand
  | SetMulticamCommand
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
      | "TIMELINE_SPLIT_OUT_OF_RANGE"
      | "TIMELINE_MARKER_NOT_FOUND"
      | "TIMELINE_MARKER_EXISTS",
  ) {
    super(message);
    this.name = "CommandError";
  }
}

function requireObject(seq: Sequence, objectId: string): TimelineObject {
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
function sourceSpan(timelineTicks: Ticks, rate: TimelineObject["playbackRate"]): Ticks {
  return asTicks(Math.round(timelineTicks * rate));
}

/** Signed source-tick delta for a signed timeline-tick delta (may be negative). */
function signedSourceDelta(timelineDelta: number, rate: TimelineObject["playbackRate"]): number {
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
  // Asset source bounds apply to clips; nested-sequence instances are bounded by their child
  // sequence, which is validated separately.
  const bounds = object.kind === "clip" ? ctx.assetBounds?.get(object.assetId) : undefined;
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
  const object = requireObject(seq, cmd.objectId);
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

function applySetTransition(seq: Sequence, cmd: SetTransitionCommand): CommandResult {
  const object = requireObject(seq, cmd.objectId);
  if (object.kind !== "transition") {
    throw new CommandError(
      `Object ${cmd.objectId} is not a transition`,
      "TIMELINE_OBJECT_NOT_FOUND",
    );
  }
  const previous = object.transition;
  const next: TimelineObject = { ...object, transition: cmd.transition };
  const inverse: SetTransitionCommand = {
    type: "SetTransition",
    meta: invertMeta(cmd.meta, "inv"),
    objectId: cmd.objectId,
    transition: previous,
  };
  return { sequence: replaceObject(seq, next), inverse };
}

function applyTrim(seq: Sequence, cmd: TrimObjectCommand, ctx: CommandContext): CommandResult {
  const clip = requireObject(seq, cmd.objectId);
  const delta = cmd.deltaTicks;
  let next: TimelineObject;

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

  const bounds = clip.kind === "clip" ? ctx.assetBounds?.get(clip.assetId) : undefined;
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
  const clip = requireObject(seq, cmd.objectId);
  assertUnlocked(seq, clip.trackId); // cannot move off a locked track
  assertUnlocked(seq, cmd.toTrackId); // cannot move onto a locked track
  assertNoCollision(seq, cmd.toTrackId, cmd.toStartTicks, clip.durationTicks, clip.id);

  const next: TimelineObject = { ...clip, trackId: cmd.toTrackId, startTicks: cmd.toStartTicks };
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
  const clip = requireObject(seq, cmd.objectId);
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

  const left: TimelineObject = {
    ...clip,
    durationTicks: leftDuration,
    sourceDurationTicks: leftSourceDuration,
  };
  const right: TimelineObject = {
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

function applyShift(seq: Sequence, cmd: ShiftObjectsCommand): CommandResult {
  const ids = new Set(cmd.objectIds);
  const moving = seq.objects.filter((o) => ids.has(o.id));
  if (moving.length !== ids.size) {
    throw new CommandError(
      "ShiftObjects references an unknown object",
      "TIMELINE_OBJECT_NOT_FOUND",
    );
  }
  for (const o of moving) {
    assertUnlocked(seq, o.trackId);
    const newStart = asTicks(o.startTicks + cmd.deltaTicks);
    // Check the shifted position against objects that are NOT part of the moving set.
    for (const other of seq.objects) {
      if (ids.has(other.id) || other.trackId !== o.trackId) continue;
      const end = endTicks(newStart, o.durationTicks);
      if (
        intervalsOverlap(
          newStart,
          end,
          other.startTicks,
          endTicks(other.startTicks, other.durationTicks),
        )
      ) {
        throw new CommandError(
          `Shifted object ${o.id} would overlap ${other.id}`,
          "TIMELINE_COLLISION",
        );
      }
    }
  }
  const sequence: Sequence = {
    ...seq,
    objects: seq.objects.map((o) =>
      ids.has(o.id) ? { ...o, startTicks: asTicks(o.startTicks + cmd.deltaTicks) } : o,
    ),
  };
  const inverse: ShiftObjectsCommand = {
    type: "ShiftObjects",
    meta: invertMeta(cmd.meta, "inv"),
    objectIds: cmd.objectIds,
    deltaTicks: -cmd.deltaTicks,
  };
  return { sequence, inverse };
}

function applySetTrackFlag(seq: Sequence, cmd: SetTrackFlagCommand): CommandResult {
  const track = requireTrack(seq, cmd.trackId);
  const previous = track[cmd.flag];
  const sequence: Sequence = {
    ...seq,
    tracks: seq.tracks.map((t) => (t.id === cmd.trackId ? { ...t, [cmd.flag]: cmd.value } : t)),
  };
  const inverse: SetTrackFlagCommand = {
    type: "SetTrackFlag",
    meta: invertMeta(cmd.meta, "inv"),
    trackId: cmd.trackId,
    flag: cmd.flag,
    value: previous,
  };
  return { sequence, inverse };
}

function applyAddMarker(seq: Sequence, cmd: AddMarkerCommand): CommandResult {
  if (seq.markers.some((m) => m.id === cmd.marker.id)) {
    throw new CommandError(`Marker ${cmd.marker.id} already exists`, "TIMELINE_MARKER_EXISTS");
  }
  const sequence: Sequence = { ...seq, markers: [...seq.markers, cmd.marker] };
  const inverse: RemoveMarkerCommand = {
    type: "RemoveMarker",
    meta: invertMeta(cmd.meta, "inv"),
    markerId: cmd.marker.id,
  };
  return { sequence, inverse };
}

function applyRemoveMarker(seq: Sequence, cmd: RemoveMarkerCommand): CommandResult {
  const marker = seq.markers.find((m) => m.id === cmd.markerId);
  if (!marker) {
    throw new CommandError(`Marker ${cmd.markerId} not found`, "TIMELINE_MARKER_NOT_FOUND");
  }
  const sequence: Sequence = { ...seq, markers: seq.markers.filter((m) => m.id !== cmd.markerId) };
  const inverse: AddMarkerCommand = {
    type: "AddMarker",
    meta: invertMeta(cmd.meta, "inv"),
    marker,
  };
  return { sequence, inverse };
}

function applyMoveMarker(seq: Sequence, cmd: MoveMarkerCommand): CommandResult {
  const marker = seq.markers.find((m) => m.id === cmd.markerId);
  if (!marker) {
    throw new CommandError(`Marker ${cmd.markerId} not found`, "TIMELINE_MARKER_NOT_FOUND");
  }
  const sequence: Sequence = {
    ...seq,
    markers: seq.markers.map((m) => (m.id === cmd.markerId ? { ...m, atTicks: cmd.toTicks } : m)),
  };
  const inverse: MoveMarkerCommand = {
    type: "MoveMarker",
    meta: invertMeta(cmd.meta, "inv"),
    markerId: cmd.markerId,
    toTicks: marker.atTicks,
  };
  return { sequence, inverse };
}

function applySetTransform(seq: Sequence, cmd: SetTransformCommand): CommandResult {
  const obj = requireObject(seq, cmd.objectId);
  const previous = obj.transform;
  // Build the next object with the transform set, or with the key removed when clearing —
  // preserving the exact "no transform" vs "identity transform" distinction for undo.
  let next: TimelineObject;
  if (cmd.transform === undefined) {
    const rest = { ...obj };
    delete (rest as { transform?: Transform }).transform;
    next = rest;
  } else {
    next = { ...obj, transform: cmd.transform };
  }
  const inverse: SetTransformCommand = {
    type: "SetTransform",
    meta: invertMeta(cmd.meta, "inv"),
    objectId: cmd.objectId,
    transform: previous,
  };
  return { sequence: replaceObject(seq, next), inverse };
}

function applySetText(seq: Sequence, cmd: SetTextCommand): CommandResult {
  const obj = requireObject(seq, cmd.objectId);
  if (obj.kind !== "text") {
    throw new CommandError(`Object ${cmd.objectId} is not text`, "TIMELINE_OBJECT_NOT_FOUND");
  }
  const next = { ...obj, text: cmd.text, style: cmd.style };
  const inverse: SetTextCommand = {
    type: "SetText",
    meta: invertMeta(cmd.meta, "inv"),
    objectId: cmd.objectId,
    text: obj.text,
    style: obj.style,
  };
  return { sequence: replaceObject(seq, next), inverse };
}

function applySetGraphic(seq: Sequence, cmd: SetGraphicCommand): CommandResult {
  const obj = requireObject(seq, cmd.objectId);
  if (obj.kind !== "graphic") {
    throw new CommandError(`Object ${cmd.objectId} is not a graphic`, "TIMELINE_OBJECT_NOT_FOUND");
  }
  const next = { ...obj, graphic: cmd.graphic };
  const inverse: SetGraphicCommand = {
    type: "SetGraphic",
    meta: invertMeta(cmd.meta, "inv"),
    objectId: cmd.objectId,
    graphic: obj.graphic,
  };
  return { sequence: replaceObject(seq, next), inverse };
}

function applySetMulticam(seq: Sequence, cmd: SetMulticamCommand): CommandResult {
  const obj = requireObject(seq, cmd.objectId);
  if (obj.kind !== "multicam") {
    throw new CommandError(`Object ${cmd.objectId} is not a multicam`, "TIMELINE_OBJECT_NOT_FOUND");
  }
  const next = {
    ...obj,
    angles: cmd.angles,
    switches: cmd.switches,
    audioAngleId: cmd.audioAngleId,
    lockedAngleIds: cmd.lockedAngleIds,
  };
  const inverse: SetMulticamCommand = {
    type: "SetMulticam",
    meta: invertMeta(cmd.meta, "inv"),
    objectId: cmd.objectId,
    angles: obj.angles,
    switches: obj.switches,
    audioAngleId: obj.audioAngleId,
    lockedAngleIds: obj.lockedAngleIds,
  };
  return { sequence: replaceObject(seq, next), inverse };
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
    case "SetTransition":
      return applySetTransition(seq, cmd);
    case "TrimObject":
      return applyTrim(seq, cmd, ctx);
    case "MoveObject":
      return applyMove(seq, cmd);
    case "SplitObject":
      return applySplit(seq, cmd);
    case "ShiftObjects":
      return applyShift(seq, cmd);
    case "SetTrackFlag":
      return applySetTrackFlag(seq, cmd);
    case "AddMarker":
      return applyAddMarker(seq, cmd);
    case "RemoveMarker":
      return applyRemoveMarker(seq, cmd);
    case "MoveMarker":
      return applyMoveMarker(seq, cmd);
    case "SetTransform":
      return applySetTransform(seq, cmd);
    case "SetText":
      return applySetText(seq, cmd);
    case "SetGraphic":
      return applySetGraphic(seq, cmd);
    case "SetMulticam":
      return applySetMulticam(seq, cmd);
    case "Batch":
      return applyBatch(seq, cmd, ctx);
  }
}

export interface BuildCrossDissolveOptions {
  /** Id for the new transition object. */
  id: string;
  /** Outgoing clip: the transition centres on where this object ends. */
  fromId: string;
  /** Incoming clip that begins at the same boundary. */
  toId: string;
  /** Total span of the transition; it straddles the cut symmetrically. */
  durationTicks: Ticks;
  meta: CommandMeta;
}

/**
 * Build the command that drops a crossDissolve transition object over the cut between two
 * adjacent clips (DEC-EDIT-007). The transition is centred on the boundary — it starts
 * duration/2 before the cut and spans it — and lands on the outgoing clip's track. Returns an
 * AddObjectCommand (transitions are ordinary TimelineObjects), so undo is the generic
 * RemoveObject inverse.
 */
export function buildCrossDissolve(
  seq: Sequence,
  opts: BuildCrossDissolveOptions,
): AddObjectCommand {
  const from = requireObject(seq, opts.fromId);
  requireObject(seq, opts.toId);
  const boundary = endTicks(from.startTicks, from.durationTicks);
  const half = asTicks(Math.floor(opts.durationTicks / 2));
  const start = asTicks(boundary - half);
  const object: TransitionObject = {
    kind: "transition",
    id: opts.id,
    trackId: from.trackId,
    startTicks: start,
    durationTicks: opts.durationTicks,
    enabled: true,
    sourceInTicks: ZERO_TICKS,
    sourceDurationTicks: opts.durationTicks,
    playbackRate: 1,
    transition: { type: "crossDissolve" },
    fromId: opts.fromId,
    toId: opts.toId,
  };
  return { type: "AddObject", meta: opts.meta, object };
}
