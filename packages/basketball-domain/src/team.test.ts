import { describe, it, expect } from "vitest";
import { parseTeam, parseGameRules, parseGameSetup, gameSetupSchema } from "./team";

function team(id: string, name: string, abbreviation: string) {
  return { id, name, abbreviation, primaryColor: "#ff0000", secondaryColor: "#000000" };
}

function rules() {
  return {
    periodCount: 4,
    periodLengthMs: 10 * 60 * 1000,
    foulsToBonus: 5,
    timeoutsPerTeam: 4,
    overtimeLengthMs: 5 * 60 * 1000,
  };
}

describe("team/rules/game setup schemas", () => {
  it("parses a valid team", () => {
    const t = parseTeam(team("home", "Hawks", "HAW"));
    expect(t.name).toBe("Hawks");
  });

  it("accepts an optional logoAssetId and shotClockMs", () => {
    const t = parseTeam({ ...team("home", "Hawks", "HAW"), logoAssetId: "asset_1" });
    expect(t.logoAssetId).toBe("asset_1");
    const r = parseGameRules({ ...rules(), shotClockMs: 24_000 });
    expect(r.shotClockMs).toBe(24_000);
  });

  it("rejects an invalid team (missing required field)", () => {
    expect(() => parseTeam({ id: "home", name: "Hawks" })).toThrow();
  });

  it("binds home + away teams and rules into a GameSetup", () => {
    const setup = parseGameSetup({
      home: team("home", "Hawks", "HAW"),
      away: team("away", "Owls", "OWL"),
      rules: rules(),
    });
    expect(setup.home.id).toBe("home");
    expect(setup.away.id).toBe("away");
    expect(setup.rules.periodCount).toBe(4);
    expect(gameSetupSchema.safeParse(setup).success).toBe(true);
  });
});
