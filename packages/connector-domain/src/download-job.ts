// Download / localisation job lifecycle (M11 connectors).
// A DownloadJob tracks pulling a RemoteSource down to a local file so it can be localised
// (see localised-asset.ts). Pure transition helpers only — no filesystem or network I/O
// lives in this domain package; adapters drive the state machine from real progress events.
import { invalidState } from "./errors";
import type { ConnectorError } from "./errors";
import type { RemoteSource } from "./remote-source";

export const DOWNLOAD_JOB_STATES = [
  "pending",
  "running",
  "paused",
  "complete",
  "failed",
  "cancelled",
] as const;
export type DownloadJobState = (typeof DOWNLOAD_JOB_STATES)[number];

/** States a job can never leave — attempting any transition from here is illegal. */
const TERMINAL_STATES = new Set<DownloadJobState>(["complete", "cancelled"]);

export interface DownloadJob {
  id: string;
  source: RemoteSource;
  targetLocalPath: string;
  state: DownloadJobState;
  /** 0..1; only ever advances while `state === "running"`. */
  progress: number;
  /** True once cancel() has been applied. Cancellation is terminal — never cleared. */
  cancelled: boolean;
  /** Number of run attempts started (incremented by start() and retry()). */
  attempt: number;
  lastError?: ConnectorError;
}

export interface DownloadJobTransitionResult {
  job: DownloadJob;
  error?: ConnectorError;
}

export function createDownloadJob(
  id: string,
  source: RemoteSource,
  targetLocalPath: string,
): DownloadJob {
  return {
    id,
    source,
    targetLocalPath,
    state: "pending",
    progress: 0,
    cancelled: false,
    attempt: 0,
  };
}

function illegal(job: DownloadJob, action: string): DownloadJobTransitionResult {
  return {
    job,
    error: invalidState(`Cannot ${action} a download job in state "${job.state}".`),
  };
}

function ok(job: DownloadJob): DownloadJobTransitionResult {
  return { job };
}

/** pending -> running; counts as the first attempt. */
export function start(job: DownloadJob): DownloadJobTransitionResult {
  if (job.state !== "pending") return illegal(job, "start");
  return ok({ ...job, state: "running", attempt: job.attempt + 1 });
}

/**
 * Advance progress while running. Progress only advances while running, and only forward
 * (a later report can never move it backwards) — both violations are structured errors.
 */
export function progress(job: DownloadJob, value: number): DownloadJobTransitionResult {
  if (job.state !== "running") return illegal(job, "report progress on");
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    return { job, error: invalidState(`Progress ${value} is outside the valid range [0, 1].`) };
  }
  if (value < job.progress) {
    return {
      job,
      error: invalidState(`Progress cannot move backwards (had ${job.progress}, got ${value}).`),
    };
  }
  return ok({ ...job, progress: value });
}

/** running -> paused. */
export function pause(job: DownloadJob): DownloadJobTransitionResult {
  if (job.state !== "running") return illegal(job, "pause");
  return ok({ ...job, state: "paused" });
}

/** paused -> running (same attempt; does not increment the attempt counter). */
export function resume(job: DownloadJob): DownloadJobTransitionResult {
  if (job.state !== "paused") return illegal(job, "resume");
  return ok({ ...job, state: "running" });
}

/** pending | running | paused -> cancelled. Terminal: never revisitable afterwards. */
export function cancel(job: DownloadJob): DownloadJobTransitionResult {
  if (TERMINAL_STATES.has(job.state) || job.state === "failed") return illegal(job, "cancel");
  return ok({ ...job, state: "cancelled", cancelled: true });
}

/** pending | running -> failed, recording the structured cause. */
export function fail(job: DownloadJob, error: ConnectorError): DownloadJobTransitionResult {
  if (job.state !== "pending" && job.state !== "running") return illegal(job, "fail");
  return ok({ ...job, state: "failed", lastError: error });
}

/** running -> complete, snapping progress to 1. */
export function complete(job: DownloadJob): DownloadJobTransitionResult {
  if (job.state !== "running") return illegal(job, "complete");
  return ok({ ...job, state: "complete", progress: 1 });
}

/**
 * failed -> running: restart the download. Increments the attempt counter and resets
 * progress; clears the previous error since a new attempt is starting.
 */
export function retry(job: DownloadJob): DownloadJobTransitionResult {
  if (job.state !== "failed") return illegal(job, "retry");
  // Built explicitly (not spread) so the previous lastError is dropped, not carried
  // forward as `undefined` (exactOptionalPropertyTypes distinguishes the two).
  return ok({
    id: job.id,
    source: job.source,
    targetLocalPath: job.targetLocalPath,
    state: "running",
    progress: 0,
    cancelled: job.cancelled,
    attempt: job.attempt + 1,
  });
}
