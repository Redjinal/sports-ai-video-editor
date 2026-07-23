// Zod round-trip coverage for the two remaining boundary schemas (ReplaySpec is
// covered in replay.test.ts alongside buildReplay).
import { describe, it, expect } from "vitest";
import { scoreboardStateSchema, parseScoreboardState } from "./scoreboard-state";
import {
  scorebugTemplateSchema,
  parseScorebugTemplate,
  fullBug,
  minimalBug,
} from "./scorebug-template";

describe("scoreboardStateSchema", () => {
  const sample = {
    home: {
      name: "Home Hawks",
      abbreviation: "HOM",
      primaryColor: "#ff0000",
      secondaryColor: "#000000",
      score: 40,
      fouls: 2,
      timeoutsRemaining: 3,
      inBonus: false,
    },
    away: {
      name: "Away Eagles",
      abbreviation: "AWY",
      logoAssetId: "asset_away_logo",
      primaryColor: "#0000ff",
      secondaryColor: "#ffffff",
      score: 42,
      fouls: 4,
      timeoutsRemaining: 2,
      inBonus: true,
    },
    period: 2,
    gameClockMs: 300_000,
    possession: "home" as const,
    shotClockMs: 18_000,
  };

  it("round-trips through JSON", () => {
    const parsed = parseScoreboardState(JSON.parse(JSON.stringify(sample)));
    expect(parsed).toEqual(sample);
  });

  it("round-trips without the optional shot clock and logo", () => {
    const withoutOptional = {
      home: sample.home,
      away: {
        name: "Away Eagles",
        abbreviation: "AWY",
        primaryColor: "#0000ff",
        secondaryColor: "#ffffff",
        score: 42,
        fouls: 4,
        timeoutsRemaining: 2,
        inBonus: true,
      },
      period: sample.period,
      gameClockMs: sample.gameClockMs,
      possession: sample.possession,
    };
    const parsed = parseScoreboardState(JSON.parse(JSON.stringify(withoutOptional)));
    expect(parsed.shotClockMs).toBeUndefined();
    expect(parsed.away.logoAssetId).toBeUndefined();
  });

  it("rejects malformed input", () => {
    expect(() => scoreboardStateSchema.parse({ ...sample, period: 0 })).toThrow();
    expect(() => scoreboardStateSchema.parse({ ...sample, possession: "both" })).toThrow();
    expect(() => scoreboardStateSchema.parse({ ...sample, gameClockMs: -1 })).toThrow();
  });
});

describe("scorebugTemplateSchema", () => {
  it("round-trips the built-in templates through JSON", () => {
    for (const template of [minimalBug, fullBug]) {
      const parsed = parseScorebugTemplate(JSON.parse(JSON.stringify(template)));
      expect(parsed).toEqual(template);
    }
  });

  it("rejects a position outside the normalized 0..1 range", () => {
    const bad = {
      ...fullBug,
      elements: {
        ...fullBug.elements,
        score: { visible: true, position: { x: 1.5, y: 0 } },
      },
    };
    expect(() => scorebugTemplateSchema.parse(bad)).toThrow();
  });

  it("rejects a template missing a required element", () => {
    const { score: _score, ...restElements } = fullBug.elements;
    const bad = { ...fullBug, elements: restElements };
    expect(() => scorebugTemplateSchema.parse(bad)).toThrow();
  });
});
