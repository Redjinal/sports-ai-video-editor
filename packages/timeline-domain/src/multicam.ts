// Multicam editing helpers (M7). All non-destructive and pure: angles + a switch program are
// stored instructions; the live angle at any tick is derived. These build the next multicam
// state, which the UI hands to a SetMulticam command so switching is a normal undo step.
import type { MulticamAngle, MulticamObject, MulticamSwitch } from "./model";
import { type Ticks, asTicks } from "./ticks";

/** The editable multicam state a SetMulticam command replaces atomically. */
export interface MulticamProgram {
  angles: MulticamAngle[];
  switches: MulticamSwitch[];
  audioAngleId: string;
  lockedAngleIds: string[];
}

/** Snapshot the editable state of a multicam object. */
export function multicamProgram(mc: MulticamObject): MulticamProgram {
  return {
    angles: mc.angles,
    switches: mc.switches,
    audioAngleId: mc.audioAngleId,
    lockedAngleIds: mc.lockedAngleIds,
  };
}

function sortSwitches(switches: MulticamSwitch[]): MulticamSwitch[] {
  return [...switches].sort((a, b) => a.atTicks - b.atTicks);
}

/**
 * The angle live at `ticksFromStart` (object-relative): the last switch at or before t, or —
 * before the first switch — the first switch's angle, or the first angle if there are none.
 */
export function activeAngleAt(mc: MulticamObject, ticksFromStart: number): string {
  const sorted = sortSwitches(mc.switches);
  if (sorted.length === 0) return mc.angles[0]?.id ?? "";
  let active = sorted[0]!.angleId;
  for (const s of sorted) {
    if (s.atTicks <= ticksFromStart) active = s.angleId;
    else break;
  }
  return active;
}

/** Map live-switch keys 1–4 to the first four angles (returns undefined if absent). */
export function angleForKey(mc: MulticamObject, key: 1 | 2 | 3 | 4): string | undefined {
  return mc.angles[key - 1]?.id;
}

function isLocked(program: MulticamProgram, angleId: string): boolean {
  return program.lockedAngleIds.includes(angleId);
}

/**
 * Cut to `angleId` at `atTicks` (object-relative) — the live-switch action. Upserts a switch at
 * that tick (one switch per tick). Rejected (returns the input unchanged) when the target angle
 * is locked or unknown.
 */
export function switchAngle(
  program: MulticamProgram,
  atTicks: Ticks,
  angleId: string,
): MulticamProgram {
  if (!program.angles.some((a) => a.id === angleId) || isLocked(program, angleId)) return program;
  const without = program.switches.filter((s) => s.atTicks !== atTicks);
  return { ...program, switches: sortSwitches([...without, { atTicks, angleId }]) };
}

/** Move an existing switch (by index in tick order) to a new tick. */
export function moveSwitch(
  program: MulticamProgram,
  index: number,
  atTicks: Ticks,
): MulticamProgram {
  const sorted = sortSwitches(program.switches);
  const target = sorted[index];
  if (!target) return program;
  const rest = sorted.filter((_, i) => i !== index).filter((s) => s.atTicks !== atTicks);
  return { ...program, switches: sortSwitches([...rest, { atTicks, angleId: target.angleId }]) };
}

/** Remove the switch at `index` (tick order). */
export function removeSwitch(program: MulticamProgram, index: number): MulticamProgram {
  const sorted = sortSwitches(program.switches);
  if (!sorted[index]) return program;
  return { ...program, switches: sorted.filter((_, i) => i !== index) };
}

/**
 * Replace one angle with another everywhere it is live (active-angle replacement). Every switch
 * pointing at `fromAngleId` is repointed to `toAngleId`. Rejected if either angle is locked/unknown.
 */
export function replaceAngle(
  program: MulticamProgram,
  fromAngleId: string,
  toAngleId: string,
): MulticamProgram {
  const known = (id: string) => program.angles.some((a) => a.id === id);
  if (!known(fromAngleId) || !known(toAngleId)) return program;
  if (isLocked(program, fromAngleId) || isLocked(program, toAngleId)) return program;
  return {
    ...program,
    switches: program.switches.map((s) =>
      s.angleId === fromAngleId ? { ...s, angleId: toAngleId } : s,
    ),
  };
}

/** Choose which angle's audio is used, independent of video switching. */
export function setAudioAngle(program: MulticamProgram, angleId: string): MulticamProgram {
  if (!program.angles.some((a) => a.id === angleId)) return program;
  return { ...program, audioAngleId: angleId };
}

/** Toggle an angle's lock (locked angles reject switching/replacement). */
export function toggleAngleLock(program: MulticamProgram, angleId: string): MulticamProgram {
  const locked = isLocked(program, angleId);
  return {
    ...program,
    lockedAngleIds: locked
      ? program.lockedAngleIds.filter((id) => id !== angleId)
      : [...program.lockedAngleIds, angleId],
  };
}

/** Manual sync: set one angle's offset directly. */
export function applyOffset(
  program: MulticamProgram,
  angleId: string,
  offsetTicks: Ticks,
): MulticamProgram {
  return {
    ...program,
    angles: program.angles.map((a) => (a.id === angleId ? { ...a, offsetTicks } : a)),
  };
}

/**
 * Timecode sync: align every angle that carries `timecodeStartTicks` so their embedded timecodes
 * line up, using the latest start as the zero reference (offset = latestStart − angleStart, so the
 * earliest-shot angle is delayed most). Angles without a timecode are left untouched.
 */
export function syncByTimecode(program: MulticamProgram): MulticamProgram {
  const withTc = program.angles.filter((a) => a.timecodeStartTicks !== undefined);
  if (withTc.length < 2) return program;
  const latest = Math.max(...withTc.map((a) => a.timecodeStartTicks!));
  return {
    ...program,
    angles: program.angles.map((a) =>
      a.timecodeStartTicks !== undefined
        ? { ...a, offsetTicks: asTicks(latest - a.timecodeStartTicks) }
        : a,
    ),
  };
}
