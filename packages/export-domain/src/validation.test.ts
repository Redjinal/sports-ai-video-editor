import { describe, it, expect } from "vitest";
import { asTicks, TIMESCALE } from "@sve/timeline-domain";
import type { ExpectedOutput, ActualProbe } from "./validation";
import { validateExport, expectedOutputFrom, DEFAULT_TOLERANCES } from "./validation";

const S = TIMESCALE;

function expected(overrides: Partial<ExpectedOutput> = {}): ExpectedOutput {
  return {
    container: "mp4",
    videoCodec: "h264",
    audioCodec: "aac",
    resolution: "1080p",
    fps: 30,
    durationTicks: asTicks(S * 60),
    hasAudio: true,
    ...overrides,
  };
}

function actual(overrides: Partial<ActualProbe> = {}): ActualProbe {
  return {
    container: "mp4",
    videoCodec: "h264",
    audioCodec: "aac",
    width: 1920,
    height: 1080,
    fps: 30,
    durationTicks: asTicks(S * 60),
    hasAudio: true,
    avSyncOffsetTicks: 0,
    ...overrides,
  };
}

describe("validateExport", () => {
  it("passes a correct output", () => {
    const result = validateExport(expected(), actual());
    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("flags a truncated output (short duration)", () => {
    const result = validateExport(
      expected({ durationTicks: asTicks(S * 60) }),
      actual({ durationTicks: asTicks(S * 45) }),
    );
    expect(result.ok).toBe(false);
    expect(result.failures.map((f) => f.code)).toContain("duration_mismatch");
  });

  it("flags a codec mismatch", () => {
    const result = validateExport(expected({ videoCodec: "h265" }), actual({ videoCodec: "h264" }));
    expect(result.ok).toBe(false);
    expect(result.failures.map((f) => f.code)).toContain("codec_mismatch");
  });

  it("flags a resolution mismatch", () => {
    const result = validateExport(
      expected({ resolution: "1080p" }),
      actual({ width: 1280, height: 720 }),
    );
    expect(result.ok).toBe(false);
    expect(result.failures.map((f) => f.code)).toContain("resolution_mismatch");
  });

  it("flags A/V sync drift beyond tolerance", () => {
    const result = validateExport(
      expected(),
      actual({ avSyncOffsetTicks: DEFAULT_TOLERANCES.avSyncToleranceTicks * 3 }),
    );
    expect(result.ok).toBe(false);
    expect(result.failures.map((f) => f.code)).toContain("av_sync_drift");
  });

  it("tolerates A/V sync drift within tolerance", () => {
    const result = validateExport(
      expected(),
      actual({ avSyncOffsetTicks: Math.floor(DEFAULT_TOLERANCES.avSyncToleranceTicks / 2) }),
    );
    expect(result.ok).toBe(true);
  });

  it("flags a missing audio track when audio was expected", () => {
    const result = validateExport(
      expected({ hasAudio: true }),
      actual({ hasAudio: false, audioCodec: null }),
    );
    expect(result.ok).toBe(false);
    expect(result.failures.map((f) => f.code)).toContain("missing_audio");
  });

  it("flags an audio codec mismatch", () => {
    const result = validateExport(expected(), actual({ audioCodec: "mp3" }));
    expect(result.ok).toBe(false);
    expect(result.failures.map((f) => f.code)).toContain("audio_codec_mismatch");
  });

  it("flags an fps mismatch beyond tolerance", () => {
    const result = validateExport(expected({ fps: 30 }), actual({ fps: 24 }));
    expect(result.ok).toBe(false);
    expect(result.failures.map((f) => f.code)).toContain("fps_mismatch");
  });

  it("tolerates fps rounding noise (29.97 vs 30) within tolerance", () => {
    const result = validateExport(
      expected({ fps: { numerator: 30000, denominator: 1001 } }),
      actual({ fps: 30 }),
    );
    expect(result.ok).toBe(true);
  });

  it("flags a container mismatch", () => {
    const result = validateExport(expected(), actual({ container: "mov" }));
    expect(result.ok).toBe(false);
    expect(result.failures.map((f) => f.code)).toContain("container_mismatch");
  });

  it("collects multiple simultaneous failures", () => {
    const result = validateExport(
      expected({ videoCodec: "h265", resolution: "4k" }),
      actual({ videoCodec: "h264", width: 1280, height: 720, durationTicks: asTicks(0) }),
    );
    expect(result.ok).toBe(false);
    expect(result.failures.length).toBeGreaterThanOrEqual(3);
  });

  it("an existing output file alone is never proof of success: a probe that disagrees on every axis fails", () => {
    // Simulates a file that exists on disk but doesn't match anything that was requested.
    const result = validateExport(
      expected({ videoCodec: "h264", resolution: "1080p", fps: 30, hasAudio: true }),
      actual({
        videoCodec: "h265",
        width: 1280,
        height: 720,
        fps: 24,
        durationTicks: asTicks(S * 5),
        hasAudio: false,
        audioCodec: null,
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.failures.length).toBeGreaterThan(1);
  });
});

describe("expectedOutputFrom", () => {
  it("derives expected output from settings + duration", () => {
    const out = expectedOutputFrom(
      { container: "mp4", videoCodec: "h264", audioCodec: "aac", resolution: "1080p", fps: 30 },
      asTicks(S * 10),
      true,
    );
    expect(out).toEqual(expected({ durationTicks: asTicks(S * 10) }));
  });
});
