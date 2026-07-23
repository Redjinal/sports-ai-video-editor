import { describe, it, expect } from "vitest";
import { buildPlayerLowerThird } from "./player-lower-third";

describe("buildPlayerLowerThird", () => {
  it("builds a name strap without a stat line", () => {
    const vm = buildPlayerLowerThird({
      name: "Jordan Carter",
      number: 23,
      teamColors: { primaryColor: "#123456", secondaryColor: "#abcdef" },
    });
    expect(vm.displayName).toBe("#23 Jordan Carter");
    expect(vm.number).toBe(23);
    expect(vm.primaryColor).toBe("#123456");
    expect(vm.secondaryColor).toBe("#abcdef");
    expect(vm.statLineLabel).toBeUndefined();
  });

  it("formats a partial stat line", () => {
    const vm = buildPlayerLowerThird({
      name: "Jordan Carter",
      number: 23,
      teamColors: { primaryColor: "#123456", secondaryColor: "#abcdef" },
      statLine: { points: 18, assists: 5 },
    });
    expect(vm.statLineLabel).toBe("18 PTS · 5 AST");
  });

  it("formats a full stat line", () => {
    const vm = buildPlayerLowerThird({
      name: "Jordan Carter",
      number: 23,
      teamColors: { primaryColor: "#123456", secondaryColor: "#abcdef" },
      statLine: { points: 18, rebounds: 7, assists: 5 },
    });
    expect(vm.statLineLabel).toBe("18 PTS · 7 REB · 5 AST");
  });

  it("omits the stat line label when the stat line is empty", () => {
    const vm = buildPlayerLowerThird({
      name: "Jordan Carter",
      number: 23,
      teamColors: { primaryColor: "#123456", secondaryColor: "#abcdef" },
      statLine: {},
    });
    expect(vm.statLineLabel).toBeUndefined();
  });
});
