import { describe, it, expect } from "vitest";
import { asTicks } from "@sve/timeline-domain";
import type { GameEvent, ScoreEvent } from "./events";
import type { TeamIds } from "./derive";
import { computeScore, computeTeamFouls } from "./derive";
import { editEvent, removeEvent, insertEvent, appendEvent, correctScore } from "./corrections";
import { gameClockToTicks, ticksToGameClock, type ClockAnchor } from "./clock";

const teams: TeamIds = { home: "home", away: "away" };

function t(n: number) {
  return asTicks(n);
}

describe("editEvent", () => {
  it("returns a new log with the event replaced, leaving the original untouched", () => {
    const log: GameEvent[] = [
      {
        type: "score",
        id: "e1",
        atTicks: t(0),
        gameClockMs: 0,
        teamId: "home",
        playerId: "p1",
        points: 2,
      },
    ];
    const next = editEvent(log, "e1", (ev) => (ev.type === "score" ? { ...ev, points: 3 } : ev));
    expect((next[0] as ScoreEvent).points).toBe(3);
    expect((log[0] as ScoreEvent).points).toBe(2); // input log is not mutated
  });

  it("throws for an unknown event id", () => {
    expect(() => editEvent([], "missing", (ev) => ev)).toThrow();
  });

  it("refuses an update() that changes the event id", () => {
    const log: GameEvent[] = [
      {
        type: "score",
        id: "e1",
        atTicks: t(0),
        gameClockMs: 0,
        teamId: "home",
        playerId: "p1",
        points: 2,
      },
    ];
    expect(() => editEvent(log, "e1", (ev) => ({ ...ev, id: "e2" }))).toThrow();
  });
});

describe("removeEvent", () => {
  it("removes an event by id, leaving the original log untouched", () => {
    const log: GameEvent[] = [
      {
        type: "score",
        id: "e1",
        atTicks: t(0),
        gameClockMs: 0,
        teamId: "home",
        playerId: "p1",
        points: 2,
      },
      {
        type: "score",
        id: "e2",
        atTicks: t(1),
        gameClockMs: 0,
        teamId: "home",
        playerId: "p1",
        points: 3,
      },
    ];
    const next = removeEvent(log, "e1");
    expect(next).toHaveLength(1);
    expect(next[0]?.id).toBe("e2");
    expect(log).toHaveLength(2);
  });

  it("throws for an unknown event id", () => {
    expect(() => removeEvent([], "missing")).toThrow();
  });
});

describe("insertEvent / appendEvent", () => {
  it("appends to the end by default", () => {
    const log: GameEvent[] = [];
    const withOne = appendEvent(log, {
      type: "timeout",
      id: "e1",
      atTicks: t(0),
      gameClockMs: 0,
      teamId: "home",
    });
    expect(withOne).toHaveLength(1);
    expect(log).toHaveLength(0);
  });

  it("inserts at a specific index", () => {
    const log: GameEvent[] = [
      { type: "timeout", id: "e1", atTicks: t(0), gameClockMs: 0, teamId: "home" },
      { type: "timeout", id: "e3", atTicks: t(2), gameClockMs: 0, teamId: "home" },
    ];
    const next = insertEvent(
      log,
      { type: "timeout", id: "e2", atTicks: t(1), gameClockMs: 0, teamId: "home" },
      1,
    );
    expect(next.map((e) => e.id)).toEqual(["e1", "e2", "e3"]);
  });
});

describe("correctScore", () => {
  it("appends an adjustment event that fixes the derived total without editing history", () => {
    const log: GameEvent[] = [
      {
        type: "score",
        id: "e1",
        atTicks: t(0),
        gameClockMs: 0,
        teamId: "home",
        playerId: "p1",
        points: 2,
      },
    ];
    expect(computeScore(log, teams).home).toBe(2);

    const corrected = correctScore(log, teams, {
      id: "adj1",
      teamId: "home",
      atTicks: t(500),
      gameClockMs: 500,
      correctTotal: 5,
      reason: "Scorekeeper missed a 3-pointer",
    });

    expect(computeScore(corrected, teams).home).toBe(5);
    // Original score event is still present, untouched — this is a correction, not a rewrite.
    expect(corrected.some((ev) => ev.id === "e1" && ev.type === "score" && ev.points === 2)).toBe(
      true,
    );
    expect(log).toHaveLength(1); // input log untouched
  });

  it("is a no-op when the score is already correct", () => {
    const log: GameEvent[] = [
      {
        type: "score",
        id: "e1",
        atTicks: t(0),
        gameClockMs: 0,
        teamId: "home",
        playerId: "p1",
        points: 2,
      },
    ];
    const result = correctScore(log, teams, {
      id: "adj1",
      teamId: "home",
      atTicks: t(0),
      gameClockMs: 0,
      correctTotal: 2,
      reason: "already correct",
    });
    expect(result).toHaveLength(1);
  });

  it("rejects a teamId that is neither home nor away", () => {
    expect(() =>
      correctScore([], teams, {
        id: "adj1",
        teamId: "not-a-team",
        atTicks: t(0),
        gameClockMs: 0,
        correctTotal: 2,
        reason: "x",
      }),
    ).toThrow();
  });
});

describe("exit criteria: log, correct, and re-derive an accurate score/clock/history", () => {
  it("supports the full correction workflow end to end", () => {
    const anchors: ClockAnchor[] = [
      { id: "a1", period: 1, gameClockMs: 600_000, atTicks: t(0) },
      { id: "a2", period: 1, gameClockMs: 0, atTicks: t(27_000_000 * 600) },
    ];

    // 1. Log a period with a mis-recorded score (should have been a 3, logged as a 2) and a
    //    foul, at a known game-clock reading.
    const misreadAtMs = 580_000;
    const misreadAtTicks = gameClockToTicks(anchors, { period: 1, gameClockMs: misreadAtMs });
    let log: GameEvent[] = [
      { type: "periodStart", id: "ps1", atTicks: t(0), gameClockMs: 600_000, period: 1 },
      {
        type: "score",
        id: "e1",
        atTicks: misreadAtTicks,
        gameClockMs: misreadAtMs,
        teamId: "home",
        playerId: "p1",
        points: 2,
      },
      {
        type: "foul",
        id: "e2",
        atTicks: t(100),
        gameClockMs: 570_000,
        teamId: "away",
        playerId: "p9",
        kind: "personal",
      },
    ];

    // The clock reading recovers the same ticks position that produced it.
    expect(ticksToGameClock(anchors, misreadAtTicks).gameClockMs).toBeCloseTo(misreadAtMs, -1);

    // Score before correction reflects the mistake.
    expect(computeScore(log, teams)).toEqual({ home: 2, away: 0 });

    // 2. Correct it directly by editing the mis-logged event (it's identifiable: e1).
    log = editEvent(log, "e1", (ev) => (ev.type === "score" ? { ...ev, points: 3 } : ev));
    expect(computeScore(log, teams)).toEqual({ home: 3, away: 0 });

    // 3. A separate, unrelated scorekeeping error is fixed with an appended adjustment
    //    instead of editing history (e.g. a make that was never logged at all).
    log = correctScore(log, teams, {
      id: "adj1",
      teamId: "home",
      atTicks: t(200),
      gameClockMs: 560_000,
      correctTotal: 5,
      reason: "Unlogged and-one free throw",
    });

    // 4. Derived state is fully consistent after both corrections, and history is preserved.
    expect(computeScore(log, teams)).toEqual({ home: 5, away: 0 });
    expect(computeTeamFouls(log, 1, teams)).toEqual({ home: 0, away: 1 });
    expect(log.find((ev) => ev.id === "e1")).toBeDefined();
    expect(log.find((ev) => ev.id === "adj1")).toBeDefined();
  });
});
