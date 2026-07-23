import { describe, it, expect } from "vitest";
import { asTicks } from "@sve/timeline-domain";
import type { GameEvent } from "./events";
import { filterEvents } from "./filters";

function t(n: number) {
  return asTicks(n);
}

const log: GameEvent[] = [
  { type: "periodStart", id: "ps1", atTicks: t(0), gameClockMs: 600_000, period: 1 },
  {
    type: "score",
    id: "e1",
    atTicks: t(10),
    gameClockMs: 590_000,
    teamId: "home",
    playerId: "p1",
    points: 2,
  },
  {
    type: "foul",
    id: "e2",
    atTicks: t(20),
    gameClockMs: 580_000,
    teamId: "away",
    playerId: "p9",
    kind: "personal",
  },
  { type: "timeout", id: "e3", atTicks: t(30), gameClockMs: 570_000, teamId: "home" },
  {
    type: "substitution",
    id: "e4",
    atTicks: t(40),
    gameClockMs: 560_000,
    teamId: "away",
    playerInId: "p10",
    playerOutId: "p9",
  },
  { type: "periodEnd", id: "pe1", atTicks: t(50), gameClockMs: 0, period: 1 },
  { type: "periodStart", id: "ps2", atTicks: t(60), gameClockMs: 600_000, period: 2 },
  {
    type: "score",
    id: "e5",
    atTicks: t(70),
    gameClockMs: 590_000,
    teamId: "away",
    playerId: "p10",
    points: 3,
  },
  {
    type: "custom",
    id: "e6",
    atTicks: t(80),
    gameClockMs: 580_000,
    label: "Timeout call reviewed",
    teamId: "home",
  },
];

describe("filterEvents", () => {
  it("filters by type", () => {
    expect(filterEvents(log, { types: ["score"] }).map((e) => e.id)).toEqual(["e1", "e5"]);
  });

  it("filters by team", () => {
    expect(filterEvents(log, { teamId: "away" }).map((e) => e.id)).toEqual(["e2", "e4", "e5"]);
  });

  it("filters by player, matching either side of a substitution", () => {
    expect(filterEvents(log, { playerId: "p9" }).map((e) => e.id)).toEqual(["e2", "e4"]);
    expect(filterEvents(log, { playerId: "p10" }).map((e) => e.id)).toEqual(["e4", "e5"]);
  });

  it("filters by period, attributing non-period events to the currently open period", () => {
    expect(filterEvents(log, { period: 1 }).map((e) => e.id)).toEqual([
      "ps1",
      "e1",
      "e2",
      "e3",
      "e4",
      "pe1",
    ]);
    expect(filterEvents(log, { period: 2 }).map((e) => e.id)).toEqual(["ps2", "e5", "e6"]);
  });

  it("combines multiple criteria", () => {
    expect(
      filterEvents(log, { types: ["score"], teamId: "away", period: 2 }).map((e) => e.id),
    ).toEqual(["e5"]);
  });

  it("returns everything when no criteria are given", () => {
    expect(filterEvents(log, {})).toHaveLength(log.length);
  });
});
