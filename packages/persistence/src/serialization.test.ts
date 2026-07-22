import { describe, it, expect } from "vitest";
import { stableStringify } from "./serialization";

describe("stableStringify", () => {
  it("orders keys deterministically regardless of insertion order", () => {
    const a = stableStringify({ b: 1, a: 2, c: { z: 1, y: 2 } });
    const b = stableStringify({ c: { y: 2, z: 1 }, a: 2, b: 1 });
    expect(a).toBe(b);
  });

  it("preserves array order", () => {
    expect(stableStringify([3, 1, 2])).toBe(JSON.stringify([3, 1, 2], null, 2));
  });

  it("round-trips through JSON.parse unchanged", () => {
    const value = { schemaVersion: 1, sequences: [{ id: "s", objects: [] }] };
    expect(JSON.parse(stableStringify(value))).toEqual(value);
  });
});
