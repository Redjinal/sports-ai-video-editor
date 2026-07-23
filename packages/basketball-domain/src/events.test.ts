import { describe, it, expect } from "vitest";
import { asTicks } from "@sve/timeline-domain";
import { parseGameEvent, parseGameLog, type ScoreEvent } from "./events";

describe("GameEvent validation", () => {
  it("parses a valid score event and reapplies the Ticks brand", () => {
    const raw: ScoreEvent = {
      type: "score",
      id: "ev1",
      atTicks: asTicks(1000),
      gameClockMs: 600_000,
      teamId: "home",
      playerId: "p1",
      points: 2,
    };
    const parsed = parseGameEvent(raw);
    expect(parsed).toEqual(raw);
  });

  it("rejects an event with an invalid discriminant field", () => {
    expect(() =>
      parseGameEvent({
        type: "score",
        id: "ev1",
        atTicks: 0,
        gameClockMs: 0,
        teamId: "home",
        playerId: "p1",
        points: 5, // not 1|2|3
      }),
    ).toThrow();
  });

  it("rejects an unknown event type", () => {
    expect(() => parseGameEvent({ type: "not-a-real-type", id: "ev1" })).toThrow();
  });

  it("parses an ordered log of mixed event types", () => {
    const log = parseGameLog([
      { type: "periodStart", id: "e1", atTicks: 0, gameClockMs: 600_000, period: 1 },
      {
        type: "score",
        id: "e2",
        atTicks: 1000,
        gameClockMs: 590_000,
        teamId: "home",
        playerId: "p1",
        points: 3,
      },
      {
        type: "foul",
        id: "e3",
        atTicks: 2000,
        gameClockMs: 580_000,
        teamId: "away",
        playerId: "p2",
        kind: "personal",
      },
    ]);
    expect(log).toHaveLength(3);
    expect(log[1]?.type).toBe("score");
  });
});
