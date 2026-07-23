import { describe, it, expect } from "vitest";
import { asTicks } from "@sve/timeline-domain";
import type { GameEvent } from "./events";
import type { GameRules } from "./team";
import {
  computeScore,
  computePlayerPoints,
  computeTeamFouls,
  isInBonus,
  timeoutsRemaining,
  currentPeriod,
  onCourtPlayers,
  type TeamIds,
} from "./derive";

const teams: TeamIds = { home: "home", away: "away" };

const rules: GameRules = {
  periodCount: 4,
  periodLengthMs: 10 * 60 * 1000,
  foulsToBonus: 5,
  timeoutsPerTeam: 4,
  overtimeLengthMs: 5 * 60 * 1000,
};

function t(n: number) {
  return asTicks(n);
}

function score(
  id: string,
  teamId: string,
  playerId: string,
  points: 1 | 2 | 3,
  atTicks = 0,
): GameEvent {
  return { type: "score", id, atTicks: t(atTicks), gameClockMs: 0, teamId, playerId, points };
}

function foul(id: string, teamId: string, playerId: string, atTicks = 0): GameEvent {
  return {
    type: "foul",
    id,
    atTicks: t(atTicks),
    gameClockMs: 0,
    teamId,
    playerId,
    kind: "personal",
  };
}

describe("computeScore", () => {
  it("sums 1/2/3-point score events per team", () => {
    const log: GameEvent[] = [
      score("e1", "home", "p1", 2, 0),
      score("e2", "away", "p2", 3, 100),
      score("e3", "home", "p3", 1, 200),
      score("e4", "home", "p1", 2, 300),
    ];
    expect(computeScore(log, teams)).toEqual({ home: 5, away: 3 });
  });

  it("ignores non-score events and events for unknown teams", () => {
    const log: GameEvent[] = [
      score("e1", "home", "p1", 2),
      { type: "timeout", id: "e2", atTicks: t(0), gameClockMs: 0, teamId: "home" },
      score("e3", "third-party", "p9", 3),
    ];
    expect(computeScore(log, teams)).toEqual({ home: 2, away: 0 });
  });
});

describe("computePlayerPoints", () => {
  it("sums points per player across events", () => {
    const log: GameEvent[] = [
      score("e1", "home", "p1", 2),
      score("e2", "home", "p1", 3),
      score("e3", "away", "p2", 1),
    ];
    expect(computePlayerPoints(log)).toEqual({ p1: 5, p2: 1 });
  });
});

describe("computeTeamFouls / isInBonus", () => {
  it("counts fouls scoped to a period", () => {
    const log: GameEvent[] = [
      { type: "periodStart", id: "ps1", atTicks: t(0), gameClockMs: 600_000, period: 1 },
      foul("f1", "home", "p1", 100),
      foul("f2", "home", "p2", 200),
      { type: "periodEnd", id: "pe1", atTicks: t(300), gameClockMs: 0, period: 1 },
      { type: "periodStart", id: "ps2", atTicks: t(400), gameClockMs: 600_000, period: 2 },
      foul("f3", "home", "p1", 500),
    ];
    expect(computeTeamFouls(log, 1, teams)).toEqual({ home: 2, away: 0 });
    expect(computeTeamFouls(log, 2, teams)).toEqual({ home: 1, away: 0 });
  });

  it("reports bonus once a team crosses the fouls-to-bonus threshold", () => {
    const log: GameEvent[] = [
      { type: "periodStart", id: "ps1", atTicks: t(0), gameClockMs: 600_000, period: 1 },
      ...Array.from({ length: 4 }, (_, i) => foul(`f${i}`, "home", "p1", i)),
    ];
    expect(isInBonus(log, 1, "home", teams, rules)).toBe(false);
    const withOneMore = [...log, foul("f5", "home", "p1", 10)];
    expect(isInBonus(withOneMore, 1, "home", teams, rules)).toBe(true);
    expect(isInBonus(withOneMore, 1, "away", teams, rules)).toBe(false);
  });
});

describe("timeoutsRemaining", () => {
  it("decrements as timeouts are logged and clamps at zero", () => {
    const log: GameEvent[] = [
      { type: "timeout", id: "to1", atTicks: t(0), gameClockMs: 0, teamId: "home" },
      { type: "timeout", id: "to2", atTicks: t(0), gameClockMs: 0, teamId: "home" },
    ];
    expect(timeoutsRemaining(log, "home", rules)).toBe(2);
    expect(timeoutsRemaining(log, "away", rules)).toBe(4);

    const overused: GameEvent[] = Array.from({ length: 6 }, (_, i) => ({
      type: "timeout" as const,
      id: `to${i}`,
      atTicks: t(0),
      gameClockMs: 0,
      teamId: "home",
    }));
    expect(timeoutsRemaining(overused, "home", rules)).toBe(0);
  });
});

describe("currentPeriod", () => {
  it("defaults to 1 with no periodStart events, then tracks the latest one", () => {
    expect(currentPeriod([])).toBe(1);
    const log: GameEvent[] = [
      { type: "periodStart", id: "ps1", atTicks: t(0), gameClockMs: 0, period: 1 },
      { type: "periodEnd", id: "pe1", atTicks: t(10), gameClockMs: 0, period: 1 },
      { type: "periodStart", id: "ps2", atTicks: t(20), gameClockMs: 0, period: 2 },
    ];
    expect(currentPeriod(log)).toBe(2);
  });
});

describe("onCourtPlayers", () => {
  it("starts from the initial lineup and applies substitutions in order", () => {
    const log: GameEvent[] = [
      {
        type: "substitution",
        id: "s1",
        atTicks: t(0),
        gameClockMs: 0,
        teamId: "home",
        playerInId: "p6",
        playerOutId: "p1",
      },
      {
        type: "substitution",
        id: "s2",
        atTicks: t(10),
        gameClockMs: 0,
        teamId: "away",
        playerInId: "p9",
        playerOutId: "p8",
      },
    ];
    const starters = ["p1", "p2", "p3", "p4", "p5"];
    const onCourt = onCourtPlayers(log, "home", starters);
    expect(onCourt).toContain("p6");
    expect(onCourt).not.toContain("p1");
    expect(onCourt).toHaveLength(5);
    // Substitution for the other team doesn't affect this team's on-court set.
    expect(onCourtPlayers(log, "home", starters)).not.toContain("p9");
  });

  it("returns an empty on-court set with no initial lineup and no subs", () => {
    expect(onCourtPlayers([], "home")).toEqual([]);
  });
});
