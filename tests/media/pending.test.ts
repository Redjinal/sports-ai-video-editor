// Placeholder for the media-output suite. Real media tests (import -> proxy -> export ->
// validate against a synthetic H.264/AAC fixture) are added in M1 Task 5 once the
// FFmpeg native adapter and fixture exist. Kept so `pnpm test:media` has a target.
import { describe, it, expect } from "vitest";

describe("media suite (pending fixture + native adapter)", () => {
  it("is a placeholder until M1 Task 5", () => {
    expect(true).toBe(true);
  });
});
