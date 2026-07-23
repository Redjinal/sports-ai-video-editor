// Export output validation (media-engine.md §4 "Export validation"; decisions.md hard invariant:
// an existing output file is NOT proof of a successful export). `validateExport` is a pure
// comparison of what the export was supposed to produce (ExpectedOutput) against what a platform
// media adapter (FFprobe / MediaCodec) actually probed from the rendered file (ActualProbe).
// This module never touches a file or runs a probe itself — it is fed real probe data by an
// adapter elsewhere; here it only proves it catches every required failure mode.
import type { Ticks } from "@sve/timeline-domain";
import type { AudioCodec, Container, Fps, Resolution, VideoCodec } from "./settings";
import { fpsToNumber, resolutionToDimensions } from "./settings";

/** What the export was supposed to produce, derived from settings + the exported duration. */
export interface ExpectedOutput {
  container: Container;
  videoCodec: VideoCodec;
  audioCodec: AudioCodec;
  resolution: Resolution;
  fps: Fps;
  durationTicks: Ticks;
  hasAudio: boolean;
}

/** Derive the expected output from settings and the duration actually being exported (the full
 *  sequence, or `settings.testRange`'s span for a test export). */
export function expectedOutputFrom(
  settings: {
    container: Container;
    videoCodec: VideoCodec;
    audioCodec: AudioCodec;
    resolution: Resolution;
    fps: Fps;
  },
  durationTicks: Ticks,
  hasAudio: boolean,
): ExpectedOutput {
  return {
    container: settings.container,
    videoCodec: settings.videoCodec,
    audioCodec: settings.audioCodec,
    resolution: settings.resolution,
    fps: settings.fps,
    durationTicks,
    hasAudio,
  };
}

/**
 * What a platform media adapter (FFprobe / MediaCodec) reports after probing the actual output
 * file. Codec/container fields are raw strings, not our own settings vocabulary — a probe
 * reports whatever the file actually contains, which is exactly what might disagree with what
 * was requested.
 */
export interface ActualProbe {
  container: string;
  videoCodec: string;
  audioCodec: string | null;
  width: number;
  height: number;
  fps: number;
  durationTicks: Ticks;
  hasAudio: boolean;
  /** Signed drift between audio and video start, in ticks; 0 is perfect sync. */
  avSyncOffsetTicks: number;
}

export interface ValidationTolerances {
  /** Allowed |actual - expected| fps deviation (absorbs encoder rounding noise). */
  fpsTolerance: number;
  /** Allowed |actual - expected| duration deviation in ticks; catches a truncated render. */
  durationToleranceTicks: number;
  /** Allowed |avSyncOffsetTicks| in ticks. */
  avSyncToleranceTicks: number;
}

/** 1ms duration slack, ~40ms A/V sync slack (a commonly cited lip-sync perceptibility threshold). */
export const DEFAULT_TOLERANCES: ValidationTolerances = {
  fpsTolerance: 0.05,
  durationToleranceTicks: 27_000,
  avSyncToleranceTicks: 27_000 * 40,
};

export type ValidationFailureCode =
  | "container_mismatch"
  | "codec_mismatch"
  | "audio_codec_mismatch"
  | "resolution_mismatch"
  | "fps_mismatch"
  | "duration_mismatch"
  | "missing_audio"
  | "av_sync_drift";

export interface ValidationFailure {
  code: ValidationFailureCode;
  message: string;
  expected: unknown;
  actual: unknown;
}

export interface ValidationResult {
  ok: boolean;
  failures: ValidationFailure[];
}

/**
 * Compare a probed export output against what it was supposed to be. `ok` is true only when
 * container, codec, resolution, fps, duration, and (when audio is expected) audio codec and A/V
 * sync all match within tolerance — an output file existing on disk is never sufficient on its
 * own (the hard invariant this module exists to enforce).
 */
export function validateExport(
  expected: ExpectedOutput,
  actual: ActualProbe,
  tolerances: ValidationTolerances = DEFAULT_TOLERANCES,
): ValidationResult {
  const failures: ValidationFailure[] = [];

  if (actual.container !== expected.container) {
    failures.push({
      code: "container_mismatch",
      message: `Expected container ${expected.container}, got ${actual.container}`,
      expected: expected.container,
      actual: actual.container,
    });
  }

  if (actual.videoCodec !== expected.videoCodec) {
    failures.push({
      code: "codec_mismatch",
      message: `Expected video codec ${expected.videoCodec}, got ${actual.videoCodec}`,
      expected: expected.videoCodec,
      actual: actual.videoCodec,
    });
  }

  const expectedDimensions = resolutionToDimensions(expected.resolution);
  if (actual.width !== expectedDimensions.width || actual.height !== expectedDimensions.height) {
    failures.push({
      code: "resolution_mismatch",
      message: `Expected ${expectedDimensions.width}x${expectedDimensions.height} (${expected.resolution}), got ${actual.width}x${actual.height}`,
      expected: expectedDimensions,
      actual: { width: actual.width, height: actual.height },
    });
  }

  const expectedFps = fpsToNumber(expected.fps);
  if (Math.abs(actual.fps - expectedFps) > tolerances.fpsTolerance) {
    failures.push({
      code: "fps_mismatch",
      message: `Expected ~${expectedFps}fps, got ${actual.fps}fps (tolerance ${tolerances.fpsTolerance})`,
      expected: expectedFps,
      actual: actual.fps,
    });
  }

  const durationDrift = Math.abs(actual.durationTicks - expected.durationTicks);
  if (durationDrift > tolerances.durationToleranceTicks) {
    failures.push({
      code: "duration_mismatch",
      message: `Expected ${expected.durationTicks} ticks, got ${actual.durationTicks} ticks (drift ${durationDrift} > tolerance ${tolerances.durationToleranceTicks}) — output may be truncated`,
      expected: expected.durationTicks,
      actual: actual.durationTicks,
    });
  }

  if (expected.hasAudio) {
    if (!actual.hasAudio || actual.audioCodec === null) {
      failures.push({
        code: "missing_audio",
        message: "Expected an audio track, but the output has none",
        expected: true,
        actual: actual.hasAudio,
      });
    } else if (actual.audioCodec !== expected.audioCodec) {
      failures.push({
        code: "audio_codec_mismatch",
        message: `Expected audio codec ${expected.audioCodec}, got ${actual.audioCodec}`,
        expected: expected.audioCodec,
        actual: actual.audioCodec,
      });
    }

    if (Math.abs(actual.avSyncOffsetTicks) > tolerances.avSyncToleranceTicks) {
      failures.push({
        code: "av_sync_drift",
        message: `A/V sync offset ${actual.avSyncOffsetTicks} ticks exceeds tolerance ${tolerances.avSyncToleranceTicks}`,
        expected: 0,
        actual: actual.avSyncOffsetTicks,
      });
    }
  }

  return { ok: failures.length === 0, failures };
}
