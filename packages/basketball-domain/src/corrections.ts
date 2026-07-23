// Corrections to the event log (M8 basketball domain).
// Because all game state is derived from the log (derive.ts), "fixing" a mistake never
// means patching a cached score/foul count directly — it means editing, removing, or
// appending an event and letting the derived selectors recompute. Every function here
// returns a new log; none mutate their input.
import type { Ticks } from "@sve/timeline-domain";
import type { GameEvent, GameLog, AdjustmentEvent } from "./events";
import { computeScore, type TeamIds } from "./derive";

/** Insert an event at a specific index (default: append to the end). Returns a new log. */
export function insertEvent(log: GameLog, event: GameEvent, atIndex?: number): GameEvent[] {
  const next = [...log];
  if (atIndex === undefined || atIndex >= next.length) {
    next.push(event);
  } else {
    next.splice(Math.max(0, atIndex), 0, event);
  }
  return next;
}

/** Append an event to the end of the log. Returns a new log. */
export function appendEvent(log: GameLog, event: GameEvent): GameEvent[] {
  return [...log, event];
}

/**
 * Edit an existing event by id. `update` receives the current event and must return the
 * corrected one (with the same id) — this keeps edits type-safe across the discriminated
 * union without a loosely-typed partial-patch API. Throws if the event id is not found or
 * the id was changed.
 */
export function editEvent(
  log: GameLog,
  eventId: string,
  update: (event: GameEvent) => GameEvent,
): GameEvent[] {
  let found = false;
  const next = log.map((ev) => {
    if (ev.id !== eventId) return ev;
    found = true;
    const updated = update(ev);
    if (updated.id !== eventId) {
      throw new Error("editEvent: update() must not change the event id");
    }
    return updated;
  });
  if (!found) {
    throw new Error(`editEvent: event ${eventId} not found`);
  }
  return next;
}

/** Remove an event by id. Returns a new log. Throws if the event id is not found. */
export function removeEvent(log: GameLog, eventId: string): GameEvent[] {
  const next = log.filter((ev) => ev.id !== eventId);
  if (next.length === log.length) {
    throw new Error(`removeEvent: event ${eventId} not found`);
  }
  return next;
}

export interface CorrectScoreParams {
  id: string;
  teamId: string;
  atTicks: Ticks;
  gameClockMs: number;
  /** The score this team's total should be after the correction. */
  correctTotal: number;
  reason: string;
}

/**
 * Convenience correction for when editing/removing the offending `score` event directly
 * isn't appropriate (e.g. the mistake isn't a single identifiable event, or the broadcast
 * history should show what was originally logged). Appends an `adjustment` event carrying
 * exactly the delta needed to make the derived score match `correctTotal`. A no-op
 * (returns the log unchanged) if the score is already correct.
 */
export function correctScore(
  log: GameLog,
  teams: TeamIds,
  params: CorrectScoreParams,
): GameEvent[] {
  if (params.teamId !== teams.home && params.teamId !== teams.away) {
    throw new Error(`correctScore: teamId ${params.teamId} is not the home or away team`);
  }
  const totals = computeScore(log, teams);
  const currentTotal = params.teamId === teams.home ? totals.home : totals.away;
  const delta = params.correctTotal - currentTotal;
  if (delta === 0) {
    return [...log];
  }
  const adjustment: AdjustmentEvent = {
    type: "adjustment",
    id: params.id,
    atTicks: params.atTicks,
    gameClockMs: params.gameClockMs,
    teamId: params.teamId,
    points: delta,
    reason: params.reason,
  };
  return appendEvent(log, adjustment);
}
