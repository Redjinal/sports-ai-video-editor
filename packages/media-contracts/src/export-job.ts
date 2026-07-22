// Export job lifecycle and output validation (media-engine.md §17–18, product S-09).
// Core rule: success requires output validation, NOT process completion.
import { z } from "zod";

/** Export job states surfaced to the UI (product S-09). */
export const exportJobStateSchema = z.enum([
  "queued",
  "analysing",
  "rendering",
  "encoding",
  "validating",
  "completed",
  "completed_with_warning",
  "cancelled",
  "failed",
]);
export type ExportJobState = z.infer<typeof exportJobStateSchema>;

export interface ExportJobProgress {
  jobId: string;
  state: ExportJobState;
  /** 0..1 within the current stage; UI shows monotonic per-stage progress. */
  stageProgress: number;
  message?: string;
}

/**
 * A single named validation check. Every export must pass its required checks;
 * a missing or truncated stream is a failure (media-engine.md §18).
 */
export interface ValidationCheck {
  name: string;
  passed: boolean;
  /** Human-readable detail, e.g. "expected 1920x1080, got 1280x720". */
  detail?: string;
  /** Required checks fail the whole job; non-required become warnings. */
  required: boolean;
}

export interface OutputValidationResult {
  /** True only when every required check passed. */
  valid: boolean;
  checks: ValidationCheck[];
  measured: {
    durationTicks: number;
    width: number;
    height: number;
    videoCodec?: string;
    audioCodec?: string;
    fileSizeBytes: number;
  };
  /** Absolute A/V drift in milliseconds at sampled points, if measured. */
  avDriftMs?: number;
}

/** Build the overall verdict from a set of checks (single source of the pass rule). */
export function summarizeValidation(
  checks: ValidationCheck[],
  measured: OutputValidationResult["measured"],
  avDriftMs?: number,
): OutputValidationResult {
  const valid = checks.every((c) => !c.required || c.passed);
  return avDriftMs === undefined
    ? { valid, checks, measured }
    : { valid, checks, measured, avDriftMs };
}
