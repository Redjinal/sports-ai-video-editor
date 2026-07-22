// Composite timeline operations (timeline-domain.md §13, §15, §16).
//
// These are pure *builders*: they read a sequence and return a single BatchCommand made of
// tested primitives (Trim/Move/Split/Shift/Add/Remove). The caller runs the batch through the
// command history, so undo is automatic and every op is atomic — either it fully applies or
// nothing does.
import type { CommandMeta, TimelineCommand, BatchCommand } from "./commands";
import type { Sequence, TimelineObject, TrackType } from "./model";
import { type Ticks, asTicks, endTicks } from "./ticks";

function subMeta(base: CommandMeta, suffix: string): CommandMeta {
  return { ...base, id: `${base.id}:${suffix}` };
}

function requireObject(seq: Sequence, objectId: string): TimelineObject {
  const o = seq.objects.find((x) => x.id === objectId);
  if (!o) throw new Error(`Object ${objectId} not found`);
  return o;
}

/** Ids of objects that begin at or after `fromTicks` on `trackId` (a track's "later" block). */
function laterOnTrack(
  seq: Sequence,
  trackId: string,
  fromTicks: Ticks,
  excludeId: string,
): string[] {
  return seq.objects
    .filter((o) => o.trackId === trackId && o.id !== excludeId && o.startTicks >= fromTicks)
    .map((o) => o.id);
}

/**
 * Ripple trim of the OUT point: change a clip's end by `deltaTicks` and shift everything after
 * it on the same track by the same delta, so no gap or overlap is introduced.
 *
 * Ripple trim of the IN point is intentionally not supported here — trimming the in-point does
 * not move later clips, and the several conflicting "ripple-in" conventions are deferred rather
 * than guessed. Use a standard start-edge TrimObject for that.
 */
export function buildRippleTrimEnd(
  seq: Sequence,
  params: { objectId: string; deltaTicks: number },
  meta: CommandMeta,
): BatchCommand {
  const clip = requireObject(seq, params.objectId);
  const clipEnd = endTicks(clip.startTicks, clip.durationTicks);
  const shiftIds = laterOnTrack(seq, clip.trackId, clipEnd, clip.id);
  const commands: TimelineCommand[] = [
    {
      type: "TrimObject",
      meta: subMeta(meta, "trim"),
      objectId: params.objectId,
      edge: "end",
      deltaTicks: params.deltaTicks,
    },
  ];
  if (shiftIds.length > 0) {
    commands.push({
      type: "ShiftObjects",
      meta: subMeta(meta, "shift"),
      objectIds: shiftIds,
      deltaTicks: params.deltaTicks,
    });
  }
  return { type: "Batch", meta, commands };
}

/**
 * Ripple delete: remove an object and close the gap by shifting everything after it on the same
 * track left by the object's duration.
 */
export function buildRippleDelete(
  seq: Sequence,
  params: { objectId: string },
  meta: CommandMeta,
): BatchCommand {
  const clip = requireObject(seq, params.objectId);
  const clipEnd = endTicks(clip.startTicks, clip.durationTicks);
  const shiftIds = laterOnTrack(seq, clip.trackId, clipEnd, clip.id);
  const commands: TimelineCommand[] = [
    { type: "RemoveObject", meta: subMeta(meta, "rm"), objectId: params.objectId },
  ];
  if (shiftIds.length > 0) {
    commands.push({
      type: "ShiftObjects",
      meta: subMeta(meta, "close"),
      objectIds: shiftIds,
      deltaTicks: -clip.durationTicks,
    });
  }
  return { type: "Batch", meta, commands };
}

/**
 * Insert: place `object` at its start on the given target tracks, shifting content at or after
 * that time to the right to make space. Untargeted and locked tracks are unaffected.
 */
export function buildInsert(
  seq: Sequence,
  params: { object: TimelineObject; targetTrackIds: string[] },
  meta: CommandMeta,
): BatchCommand {
  const at = params.object.startTicks;
  const shiftIds = seq.objects
    .filter((o) => params.targetTrackIds.includes(o.trackId) && o.startTicks >= at)
    .map((o) => o.id);
  const commands: TimelineCommand[] = [];
  if (shiftIds.length > 0) {
    commands.push({
      type: "ShiftObjects",
      meta: subMeta(meta, "make-space"),
      objectIds: shiftIds,
      deltaTicks: params.object.durationTicks,
    });
  }
  commands.push({ type: "AddObject", meta: subMeta(meta, "add"), object: params.object });
  return { type: "Batch", meta, commands };
}

const CLIP_TRACK_TYPES: readonly TrackType[] = ["video", "audio", "text", "caption", "graphic"];

/**
 * Overwrite: drop `object` onto a target track, replacing whatever it covers. Objects fully
 * inside the range are removed; objects crossing a boundary are trimmed; an object spanning the
 * whole range is split so only its covered middle is removed. Later objects do not move.
 */
export function buildOverwrite(
  seq: Sequence,
  params: { object: TimelineObject; targetTrackId: string },
  meta: CommandMeta,
): BatchCommand {
  const { object, targetTrackId } = params;
  const start = object.startTicks;
  const end = endTicks(object.startTicks, object.durationTicks);
  const commands: TimelineCommand[] = [];

  for (const o of seq.objects) {
    if (o.trackId !== targetTrackId) continue;
    const oStart = o.startTicks;
    const oEnd = endTicks(o.startTicks, o.durationTicks);
    if (oEnd <= start || oStart >= end) continue; // no intersection

    if (oStart >= start && oEnd <= end) {
      // Fully covered → remove.
      commands.push({ type: "RemoveObject", meta: subMeta(meta, `rm-${o.id}`), objectId: o.id });
    } else if (oStart < start && oEnd > end) {
      // Spans the whole range → split off the covered middle and remove it.
      const rightId = `${meta.id}:sr:${o.id}`;
      const tailId = `${meta.id}:st:${o.id}`;
      commands.push({
        type: "SplitObject",
        meta: subMeta(meta, `spl-a-${o.id}`),
        objectId: o.id,
        atTicks: asTicks(start),
        newObjectId: rightId,
      });
      commands.push({
        type: "SplitObject",
        meta: subMeta(meta, `spl-b-${o.id}`),
        objectId: rightId,
        atTicks: asTicks(end),
        newObjectId: tailId,
      });
      commands.push({ type: "RemoveObject", meta: subMeta(meta, `rm-${o.id}`), objectId: rightId });
    } else if (oStart < start) {
      // Overlaps the start boundary → trim its out-point back to `start`.
      commands.push({
        type: "TrimObject",
        meta: subMeta(meta, `trim-out-${o.id}`),
        objectId: o.id,
        edge: "end",
        deltaTicks: start - oEnd,
      });
    } else {
      // Overlaps the end boundary → trim its in-point forward to `end`.
      commands.push({
        type: "TrimObject",
        meta: subMeta(meta, `trim-in-${o.id}`),
        objectId: o.id,
        edge: "start",
        deltaTicks: end - oStart,
      });
    }
  }

  commands.push({ type: "AddObject", meta: subMeta(meta, "add"), object });
  return { type: "Batch", meta, commands };
}

/** Track types that accept source clips, used to validate insert/overwrite targets. */
export function trackAcceptsClips(type: TrackType): boolean {
  return CLIP_TRACK_TYPES.includes(type);
}

/**
 * Whether nesting `nestedSequenceId` inside `hostSequenceId` would create a cycle
 * (timeline-domain.md §31 "Circular nesting"). A self-nest is an immediate cycle; otherwise a
 * cycle forms when the host is already reachable from the child through existing nesting edges.
 * Must be checked by the caller before adding a nested-sequence object.
 */
export function wouldCreateCycle(
  sequencesById: ReadonlyMap<string, Sequence>,
  hostSequenceId: string,
  nestedSequenceId: string,
): boolean {
  if (hostSequenceId === nestedSequenceId) return true;
  const seen = new Set<string>();
  const stack = [nestedSequenceId];
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined) continue;
    if (id === hostSequenceId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    const s = sequencesById.get(id);
    if (!s) continue;
    for (const o of s.objects) {
      if (o.kind === "nested") stack.push(o.sequenceId);
    }
  }
  return false;
}

/**
 * Every object in the same link group as `objectId`, including itself. Linked video/audio
 * edit together by default (timeline-domain.md §10). An object with no link group is its own
 * singleton group.
 */
export function linkGroupMembers(seq: Sequence, objectId: string): string[] {
  const obj = requireObject(seq, objectId);
  if (!obj.linkGroupId) return [obj.id];
  return seq.objects.filter((o) => o.linkGroupId === obj.linkGroupId).map((o) => o.id);
}

/** Nudge a linked group in time by `deltaTicks` (all members move together). */
export function buildLinkedShift(
  seq: Sequence,
  params: { objectId: string; deltaTicks: number },
  meta: CommandMeta,
): BatchCommand {
  const members = linkGroupMembers(seq, params.objectId);
  return {
    type: "Batch",
    meta,
    commands: [
      {
        type: "ShiftObjects",
        meta: subMeta(meta, "shift"),
        objectIds: members,
        deltaTicks: params.deltaTicks,
      },
    ],
  };
}

/**
 * Split every member of a link group that the split point falls inside, so linked video and
 * audio split together. `newIdFor` supplies the id for each member's new right-hand part.
 */
export function buildLinkedSplit(
  seq: Sequence,
  params: { objectId: string; atTicks: Ticks; newIdFor: (memberId: string) => string },
  meta: CommandMeta,
): BatchCommand {
  const members = linkGroupMembers(seq, params.objectId);
  const commands: TimelineCommand[] = [];
  for (const id of members) {
    const o = requireObject(seq, id);
    const oEnd = endTicks(o.startTicks, o.durationTicks);
    // Only split members the point actually lands inside.
    if (params.atTicks > o.startTicks && params.atTicks < oEnd) {
      commands.push({
        type: "SplitObject",
        meta: subMeta(meta, `split-${id}`),
        objectId: id,
        atTicks: params.atTicks,
        newObjectId: params.newIdFor(id),
      });
    }
  }
  return { type: "Batch", meta, commands };
}
