// M12 exit criteria (roadmap.md §16): "Every promised platform/codec/resolution combination
// passes the certification matrix."
import { describe, it, expect } from "vitest";
import type { Combo, ComboResult } from "./certification";
import { PROMISED_MATRIX, certify } from "./certification";

function passing(): ComboResult[] {
  return PROMISED_MATRIX.map((combo) => ({ combo, ok: true }));
}

describe("M12 exit criteria: promised matrix enumeration", () => {
  it("enumerates every promised platform/codec/resolution combination", () => {
    // Windows: {h264,h265} x {720p,1080p,1440p,4k} = 8. DeX: {h264} x {720p,1080p} = 2. Total 10.
    expect(PROMISED_MATRIX).toHaveLength(10);

    const windowsCombos = PROMISED_MATRIX.filter((c) => c.platform === "windows");
    const dexCombos = PROMISED_MATRIX.filter((c) => c.platform === "dex");
    expect(windowsCombos).toHaveLength(8);
    expect(dexCombos).toHaveLength(2);
  });

  it("includes Windows h264 and h265 up to 4k", () => {
    const has = (combo: Omit<Combo, "platform">) =>
      PROMISED_MATRIX.some(
        (c) =>
          c.platform === "windows" &&
          c.videoCodec === combo.videoCodec &&
          c.resolution === combo.resolution,
      );
    expect(has({ videoCodec: "h264", resolution: "4k" })).toBe(true);
    expect(has({ videoCodec: "h265", resolution: "4k" })).toBe(true);
  });

  it("includes DeX h264 at 720p and 1080p only, and never promises DeX h265 or DeX 4k", () => {
    const dexCombos = PROMISED_MATRIX.filter((c) => c.platform === "dex");
    expect(dexCombos).toEqual(
      expect.arrayContaining([
        { platform: "dex", videoCodec: "h264", resolution: "720p" },
        { platform: "dex", videoCodec: "h264", resolution: "1080p" },
      ]),
    );
    expect(dexCombos.some((c) => c.videoCodec === "h265")).toBe(false);
    expect(dexCombos.some((c) => c.resolution === "4k" || c.resolution === "1440p")).toBe(false);
  });
});

describe("certify", () => {
  it("reports complete when every promised combo has a passing result", () => {
    const report = certify(passing());
    expect(report).toEqual({ complete: true, missing: [], failed: [] });
  });

  it("reports missing combos that were never exercised", () => {
    const results = passing().slice(1); // drop the first combo's result entirely
    const report = certify(results);
    expect(report.complete).toBe(false);
    expect(report.missing).toHaveLength(1);
    expect(report.missing[0]).toEqual(PROMISED_MATRIX[0]);
    expect(report.failed).toEqual([]);
  });

  it("reports failed combos that were exercised but did not pass validation", () => {
    const results = passing().map((r, i) => (i === 0 ? { ...r, ok: false } : r));
    const report = certify(results);
    expect(report.complete).toBe(false);
    expect(report.failed).toEqual([PROMISED_MATRIX[0]]);
    expect(report.missing).toEqual([]);
  });

  it("ignores results for combos outside the promised matrix (e.g. an unpromised DeX h265 run)", () => {
    const extra: ComboResult = {
      combo: { platform: "dex", videoCodec: "h265", resolution: "720p" },
      ok: false,
    };
    const report = certify([...passing(), extra]);
    expect(report.complete).toBe(true);
  });

  it("is empty-input safe: an empty result set reports every combo missing", () => {
    const report = certify([]);
    expect(report.complete).toBe(false);
    expect(report.missing).toHaveLength(PROMISED_MATRIX.length);
    expect(report.failed).toEqual([]);
  });
});
