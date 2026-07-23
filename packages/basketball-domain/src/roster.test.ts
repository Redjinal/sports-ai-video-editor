import { describe, it, expect } from "vitest";
import {
  parseRosterCsv,
  parseRosterJson,
  addPlayer,
  editPlayer,
  removePlayer,
  playerId,
} from "./roster";
import type { Player } from "./roster";

describe("roster CSV import", () => {
  it("parses a valid CSV roster", () => {
    const csv = ["teamId,number,name,position", "home,23,Jordan Ames,SG", "home,7,Sam Lee,"].join(
      "\n",
    );
    const result = parseRosterCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.players).toHaveLength(2);
    expect(result.players[0]).toMatchObject({
      teamId: "home",
      number: 23,
      name: "Jordan Ames",
      position: "SG",
    });
    expect(result.players[1]).toMatchObject({ teamId: "home", number: 7, name: "Sam Lee" });
    expect(result.players[1]?.position).toBeUndefined();
  });

  it("derives a stable id when the CSV omits one", () => {
    const csv = ["teamId,number,name", "home,23,Jordan Ames"].join("\n");
    const result = parseRosterCsv(csv);
    expect(result.players[0]?.id).toBe(playerId("home", 23));
  });

  it("applies a default teamId when the CSV column is absent", () => {
    const csv = ["number,name", "10,Riley Chen"].join("\n");
    const result = parseRosterCsv(csv, { teamId: "away" });
    expect(result.errors).toEqual([]);
    expect(result.players[0]?.teamId).toBe("away");
  });

  it("reports a structured error for a malformed header", () => {
    const csv = ["foo,bar", "1,2"].join("\n");
    const result = parseRosterCsv(csv);
    expect(result.players).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.line).toBe(1);
    expect(result.errors[0]?.message).toMatch(/missing required column/i);
  });

  it("reports a per-row structured error for malformed rows without failing the whole import", () => {
    const csv = [
      "teamId,number,name",
      "home,23,Jordan Ames",
      "home,notanumber,Bad Row",
      "home,9,", // missing name
    ].join("\n");
    const result = parseRosterCsv(csv);
    expect(result.players).toHaveLength(1);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]?.line).toBe(3);
    expect(result.errors[1]?.line).toBe(4);
  });

  it("reports a structured error when no teamId is available at all", () => {
    const csv = ["number,name", "10,Riley Chen"].join("\n");
    const result = parseRosterCsv(csv);
    expect(result.players).toEqual([]);
    expect(result.errors[0]?.message).toMatch(/teamId/);
  });
});

describe("roster JSON import", () => {
  it("parses a valid JSON roster", () => {
    const json = JSON.stringify([
      { id: "home#23", teamId: "home", number: 23, name: "Jordan Ames", position: "SG" },
      { teamId: "home", number: 7, name: "Sam Lee" },
    ]);
    const result = parseRosterJson(json);
    expect(result.errors).toEqual([]);
    expect(result.players).toHaveLength(2);
    expect(result.players[1]?.id).toBe(playerId("home", 7));
  });

  it("reports a structured error for invalid JSON syntax", () => {
    const result = parseRosterJson("{not valid json");
    expect(result.players).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.line).toBe(0);
    expect(result.errors[0]?.message).toMatch(/invalid json/i);
  });

  it("reports a structured error when the JSON root is not an array", () => {
    const result = parseRosterJson(JSON.stringify({ not: "an array" }));
    expect(result.players).toEqual([]);
    expect(result.errors[0]?.message).toMatch(/array/i);
  });

  it("reports a per-item structured error for malformed entries", () => {
    const json = JSON.stringify([
      { teamId: "home", number: 23, name: "Jordan Ames" },
      { teamId: "home", number: -1, name: "Bad Number" },
      "not-an-object",
    ]);
    const result = parseRosterJson(json);
    expect(result.players).toHaveLength(1);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]?.line).toBe(2);
    expect(result.errors[1]?.line).toBe(3);
  });
});

describe("manual roster edits", () => {
  const base: Player = { id: "p1", teamId: "home", number: 5, name: "Alex Kim" };

  it("adds a player, refusing duplicate ids", () => {
    const roster = addPlayer([], base);
    expect(roster).toHaveLength(1);
    expect(() => addPlayer(roster, base)).toThrow();
  });

  it("edits a player's fields", () => {
    const roster = editPlayer([base], "p1", { name: "Alex K.", position: "PG" });
    expect(roster[0]).toMatchObject({ name: "Alex K.", position: "PG" });
    expect(() => editPlayer([base], "missing", { name: "X" })).toThrow();
  });

  it("removes a player", () => {
    const roster = removePlayer([base], "p1");
    expect(roster).toEqual([]);
    expect(() => removePlayer([], "p1")).toThrow();
  });
});
