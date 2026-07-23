// Event filtering (M8 basketball domain).
import type { GameEvent, GameEventType, GameLog } from "./events";

export interface EventFilterCriteria {
  types?: readonly GameEventType[];
  teamId?: string;
  playerId?: string;
  period?: number;
}

function eventTeamId(ev: GameEvent): string | undefined {
  switch (ev.type) {
    case "score":
    case "foul":
    case "timeout":
    case "substitution":
    case "adjustment":
    case "custom":
      return ev.teamId;
    case "periodStart":
    case "periodEnd":
      return undefined;
  }
}

/** All player ids an event references (substitutions reference two). */
function eventPlayerIds(ev: GameEvent): string[] {
  switch (ev.type) {
    case "score":
    case "foul":
      return [ev.playerId];
    case "substitution":
      return [ev.playerInId, ev.playerOutId];
    case "custom":
      return ev.playerId !== undefined ? [ev.playerId] : [];
    case "timeout":
    case "periodStart":
    case "periodEnd":
    case "adjustment":
      return [];
  }
}

/**
 * Filter the log by any combination of event type, team, player, and period. Period is
 * resolved the same way `derive.ts` resolves it: the most recently started period as of
 * each event, following log order chronologically.
 */
export function filterEvents(log: GameLog, criteria: EventFilterCriteria): GameEvent[] {
  const result: GameEvent[] = [];
  let currentPeriod = 1;

  for (const ev of log) {
    if (ev.type === "periodStart") currentPeriod = ev.period;
    const eventPeriod =
      ev.type === "periodStart" || ev.type === "periodEnd" ? ev.period : currentPeriod;

    if (criteria.types && !criteria.types.includes(ev.type)) continue;
    if (criteria.teamId !== undefined && eventTeamId(ev) !== criteria.teamId) continue;
    if (criteria.playerId !== undefined && !eventPlayerIds(ev).includes(criteria.playerId))
      continue;
    if (criteria.period !== undefined && eventPeriod !== criteria.period) continue;

    result.push(ev);
  }

  return result;
}
