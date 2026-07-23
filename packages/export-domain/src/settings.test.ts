import { describe, it, expect } from "vitest";
import {
  RESOLUTION_DIMENSIONS,
  resolutionToDimensions,
  fpsToNumber,
  parseExportSettings,
  exportSettingsSchema,
} from "./settings";

function validSettings() {
  return {
    container: "mp4",
    videoCodec: "h264",
    audioCodec: "aac",
    resolution: "1080p",
    fps: 30,
    hwAccel: "auto",
    captions: "none",
  } as const;
}

describe("resolution -> dimensions", () => {
  it("maps every resolution label to its pixel dimensions", () => {
    expect(resolutionToDimensions("720p")).toEqual({ width: 1280, height: 720 });
    expect(resolutionToDimensions("1080p")).toEqual({ width: 1920, height: 1080 });
    expect(resolutionToDimensions("1440p")).toEqual({ width: 2560, height: 1440 });
    expect(resolutionToDimensions("4k")).toEqual({ width: 3840, height: 2160 });
  });

  it("has an entry for exactly the four supported resolutions", () => {
    expect(Object.keys(RESOLUTION_DIMENSIONS).sort()).toEqual(
      ["1080p", "1440p", "4k", "720p"].sort(),
    );
  });
});

describe("fpsToNumber", () => {
  it("passes through a plain number", () => {
    expect(fpsToNumber(30)).toBe(30);
  });

  it("resolves a rational rate", () => {
    expect(fpsToNumber({ numerator: 30000, denominator: 1001 })).toBeCloseTo(29.97, 2);
  });
});

describe("exportSettingsSchema / parseExportSettings", () => {
  it("accepts valid settings without a testRange", () => {
    const parsed = parseExportSettings(validSettings());
    expect(parsed.resolution).toBe("1080p");
    expect(parsed.testRange).toBeUndefined();
  });

  it("accepts a valid testRange", () => {
    const parsed = parseExportSettings({
      ...validSettings(),
      testRange: { startTicks: 0, endTicks: 27_000_000 },
    });
    expect(parsed.testRange).toEqual({ startTicks: 0, endTicks: 27_000_000 });
  });

  it("rejects an inverted testRange", () => {
    expect(() =>
      parseExportSettings({
        ...validSettings(),
        testRange: { startTicks: 27_000_000, endTicks: 0 },
      }),
    ).toThrow();
  });

  it("rejects an unsupported video codec", () => {
    expect(() => parseExportSettings({ ...validSettings(), videoCodec: "vp9" })).toThrow();
  });

  it("rejects an unsupported container", () => {
    expect(() => parseExportSettings({ ...validSettings(), container: "mkv" })).toThrow();
  });

  it("round-trips through exportSettingsSchema directly", () => {
    expect(() => exportSettingsSchema.parse(validSettings())).not.toThrow();
  });
});
