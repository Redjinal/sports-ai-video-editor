// Derived game state (M8 basketball domain).
// Every function here is a pure selector over the ordered event log: none of them hold
// state, and none of them mutate the log. Score/fouls/timeouts/on-court players are always
// recomputed from `GameLog`, so a correction (corrections.ts) only ever has to change the
// log — every derived value updates automatically and consistently.
import type { GameLog } from "./events";
import type { GameRules } from "./team";

/** Ids of the two teams in a game, used to attribute per-team derived totals. */
export interface TeamIds {
  home: string;
  away: string;
}

export interface ScoreTotals {
  home: number;
  away: number;
}

/** Sum of `score` and `adjustment` points per team, in the order they appear in the log. */
export function computeScore(log: GameLog, teams: TeamIds): ScoreTotals {
  let home = 0;
  let away = 0;
  for (const ev of log) {
    if (ev.type === "score" || ev.type === "adjustment") {
      if (ev.teamId === teams.home) home += ev.points;
      else if (ev.teamId === teams.away) away += ev.points;
    }
  }
  return { home, away };
}

/** Total points scored by each player (`score` events only). */
export function computePlayerPoints(log: GameLog): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const ev of log) {
    if (ev.type === "score") {
      totals[ev.playerId] = (totals[ev.playerId] ?? 0) + ev.points;
    }
  }
  return totals;
}

/**
 * The period each event in the log falls within, following play chronologically: a
 * `periodStart` event advances the current period; every other event is attributed to
 * whatever period is currently open (`periodEnd` does not itself advance the period — the
 * next `periodStart` does).
 */
function periodTrackedEvents(log: GameLog): Array<{ event: GameLog[number]; period: number }> {
  let period = 1;
  return log.map((event) => {
    if (event.type === "periodStart") period = event.period;
    const eventPeriod =
      event.type === "periodStart" || event.type === "periodEnd" ? event.period : period;
    return { event, period: eventPeriod };
  });
}

/** The most recently started period, or 1 if the game has not logged a `periodStart` yet. */
export function currentPeriod(log: GameLog): number {
  let period = 1;
  for (const ev of log) {
    if (ev.type === "periodStart") period = ev.period;
  }
  return period;
}

/** Team fouls charged within a given period. */
export function computeTeamFouls(log: GameLog, period: number, teams: TeamIds): ScoreTotals {
  let home = 0;
  let away = 0;
  for (const { event, period: eventPeriod } of periodTrackedEvents(log)) {
    if (event.type === "foul" && eventPeriod === period) {
      if (event.teamId === teams.home) home++;
      else if (event.teamId === teams.away) away++;
    }
  }
  return { home, away };
}

/** Whether a team has reached the bonus (fouls-to-bonus threshold) for a given period. */
export function isInBonus(
  log: GameLog,
  period: number,
  teamId: string,
  teams: TeamIds,
  rules: GameRules,
): boolean {
  const fouls = computeTeamFouls(log, period, teams);
  const count = teamId === teams.home ? fouls.home : teamId === teams.away ? fouls.away : 0;
  return count >= rules.foulsToBonus;
}

/** Timeouts a team has left for the whole game, clamped to zero (never negative). */
export function timeoutsRemaining(log: GameLog, teamId: string, rules: GameRules): number {
  const used = log.filter((ev) => ev.type === "timeout" && ev.teamId === teamId).length;
  return Math.max(0, rules.timeoutsPerTeam - used);
}

/**
 * Players currently on court for a team, starting from `initialOnCourt` (e.g. the starting
 * five) and replaying every `substitution` event for that team in log order.
 */
export function onCourtPlayers(
  log: GameLog,
  teamId: string,
  initialOnCourt: readonly string[] = [],
): string[] {
  const onCourt = new Set(initialOnCourt);
  for (const ev of log) {
    if (ev.type === "substitution" && ev.teamId === teamId) {
      onCourt.delete(ev.playerOutId);
      onCourt.add(ev.playerInId);
    }
  }
  return [...onCourt];
}
