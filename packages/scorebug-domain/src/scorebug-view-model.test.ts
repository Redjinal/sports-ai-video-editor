import { describe, it, expect } from "vitest";
import { renderScorebug } from "./scorebug-view-model";
import { minimalBug, fullBug } from "./scorebug-template";
import type { ScoreboardState } from "./scoreboard-state";

function state(overrides: Partial<ScoreboardState> = {}): ScoreboardState {
  return {
    home: {
      name: "Home Hawks",
      abbreviation: "HOM",
      primaryColor: "#ff0000",
      secondaryColor: "#000000",
      score: 58,
      fouls: 3,
      timeoutsRemaining: 2,
      inBonus: false,
    },
    away: {
      name: "Away Eagles",
      abbreviation: "AWY",
      primaryColor: "#0000ff",
      secondaryColor: "#ffffff",
      score: 61,
      fouls: 5,
      timeoutsRemaining: 1,
      inBonus: true,
    },
    period: 4,
    gameClockMs: 65_000,
    possession: "away",
    ...overrides,
  };
}

describe("renderScorebug", () => {
  it("hides fouls/timeouts/bonus/possession/shot clock in minimalBug", () => {
    const vm = renderScorebug(minimalBug, state());
    expect(vm.score.visible).toBe(true);
    expect(vm.period.visible).toBe(true);
    expect(vm.gameClock.visible).toBe(true);
    expect(vm.fouls.visible).toBe(false);
    expect(vm.timeouts.visible).toBe(false);
    expect(vm.bonus.visible).toBe(false);
    expect(vm.possession.visible).toBe(false);
  });

  it("shows every element in fullBug and includes the sponsor slot", () => {
    const vm = renderScorebug(fullBug, state());
    expect(vm.fouls.visible).toBe(true);
    expect(vm.timeouts.visible).toBe(true);
    expect(vm.bonus.visible).toBe(true);
    expect(vm.possession.visible).toBe(true);
    expect(vm.sponsor).toBeDefined();
    expect(vm.sponsor?.assetId).toBe("sponsor_default");
  });

  it("omits the sponsor slot when the template does not define one", () => {
    const vm = renderScorebug(minimalBug, state());
    expect(vm.sponsor).toBeUndefined();
  });

  it("reflects possession, bonus, timeouts, and score from state", () => {
    const vm = renderScorebug(fullBug, state());
    expect(vm.possession.value).toBe("away");
    expect(vm.bonus.home).toBe(false);
    expect(vm.bonus.away).toBe(true);
    expect(vm.timeouts.home).toBe(2);
    expect(vm.timeouts.away).toBe(1);
    expect(vm.score.home).toBe(58);
    expect(vm.score.away).toBe(61);
  });

  it("formats the game clock and period label", () => {
    const vm = renderScorebug(fullBug, state({ gameClockMs: 65_000, period: 4 }));
    expect(vm.gameClock.label).toBe("1:05");
    expect(vm.period.label).toBe("4th");
  });

  it("includes the shot clock element only when the state carries one", () => {
    const withoutShotClock = renderScorebug(fullBug, state());
    expect(withoutShotClock.shotClock).toBeUndefined();

    const withShotClock = renderScorebug(fullBug, state({ shotClockMs: 14_700 }));
    expect(withShotClock.shotClock).toBeDefined();
    expect(withShotClock.shotClock?.label).toBe("15");
    expect(withShotClock.shotClock?.visible).toBe(true);
  });

  it("carries team display fields including an optional logo asset", () => {
    const vm = renderScorebug(
      fullBug,
      state({
        home: {
          name: "Home Hawks",
          abbreviation: "HOM",
          logoAssetId: "asset_home_logo",
          primaryColor: "#ff0000",
          secondaryColor: "#000000",
          score: 58,
          fouls: 3,
          timeoutsRemaining: 2,
          inBonus: false,
        },
      }),
    );
    expect(vm.teams.home.logoAssetId).toBe("asset_home_logo");
    expect(vm.teams.away.logoAssetId).toBeUndefined();
  });
});
