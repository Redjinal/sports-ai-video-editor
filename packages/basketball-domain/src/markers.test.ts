import { describe, it, expect } from "vitest";
import { asTicks } from "@sve/timeline-domain";
import type { GameEvent } from "./events";
import { eventsToMarkers } from "./markers";

function t(n: number) {
  return asTicks(n);
}

describe("eventsToMarkers", () => {
  it("converts each event into a marker with a matching label and atTicks", () => {
    const log: GameEvent[] = [
      {
        type: "score",
        id: "e1",
        atTicks: t(100),
        gameClockMs: 0,
        teamId: "home",
        playerId: "p1",
        points: 3,
      },
      {
        type: "foul",
        id: "e2",
        atTicks: t(200),
        gameClockMs: 0,
        teamId: "away",
        playerId: "p2",
        kind: "flagrant",
      },
      { type: "periodStart", id: "e3", atTicks: t(300), gameClockMs: 0, period: 2 },
    ];
    const markers = eventsToMarkers(log);
    expect(markers).toHaveLength(3);
    expect(markers[0]).toMatchObject({ id: "marker-e1", atTicks: t(100), label: "+3 pts" });
    expect(markers[1]?.label).toBe("Foul (flagrant)");
    expect(markers[2]?.label).toBe("Period 2 start");
  });

  it("assigns a distinct color per event type by default", () => {
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
        type: "foul",
        id: "e2",
        atTicks: t(0),
        gameClockMs: 0,
        teamId: "home",
        playerId: "p1",
        kind: "personal",
      },
    ];
    const markers = eventsToMarkers(log);
    expect(markers[0]?.color).not.toBe(markers[1]?.color);
    expect(markers[0]?.color).toBeDefined();
  });

  it("supports overriding colors and the id prefix", () => {
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
    const markers = eventsToMarkers(log, { colors: { score: "#ffffff" }, idPrefix: "bball-" });
    expect(markers[0]).toMatchObject({ id: "bball-e1", color: "#ffffff" });
  });

  it("labels an adjustment event with its signed delta", () => {
    const log: GameEvent[] = [
      {
        type: "adjustment",
        id: "e1",
        atTicks: t(0),
        gameClockMs: 0,
        teamId: "home",
        points: -2,
        reason: "double-counted basket",
      },
    ];
    expect(eventsToMarkers(log)[0]?.label).toBe("Score correction (-2)");
  });
});
