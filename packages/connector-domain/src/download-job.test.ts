import { describe, it, expect } from "vitest";
import {
  createDownloadJob,
  start,
  progress,
  pause,
  resume,
  cancel,
  fail,
  complete,
  retry,
} from "./download-job";
import { networkError } from "./errors";
import type { RemoteSource } from "./remote-source";

function source(): RemoteSource {
  return { provider: "url", url: "https://example.com/game.mp4", displayName: "game.mp4" };
}

describe("DownloadJob lifecycle", () => {
  it("starts pending, with no attempts yet", () => {
    const job = createDownloadJob("job_1", source(), "C:/media/game.mp4");
    expect(job.state).toBe("pending");
    expect(job.attempt).toBe(0);
    expect(job.progress).toBe(0);
    expect(job.cancelled).toBe(false);
  });

  it("runs the full happy path: pending -> running -> complete", () => {
    let job = createDownloadJob("job_1", source(), "C:/media/game.mp4");

    const started = start(job);
    expect(started.error).toBeUndefined();
    job = started.job;
    expect(job.state).toBe("running");
    expect(job.attempt).toBe(1);

    const halfway = progress(job, 0.5);
    expect(halfway.error).toBeUndefined();
    job = halfway.job;
    expect(job.progress).toBe(0.5);

    const done = complete(job);
    expect(done.error).toBeUndefined();
    job = done.job;
    expect(job.state).toBe("complete");
    expect(job.progress).toBe(1);
  });

  it("progress only advances while running", () => {
    const pending = createDownloadJob("job_1", source(), "C:/media/game.mp4");
    const result = progress(pending, 0.2);
    expect(result.error?.code).toBe("CONNECTOR_INVALID_STATE");
    expect(result.job).toBe(pending); // unchanged

    const { job: paused } = pauseAfterStart(pending);
    const whilePaused = progress(paused, 0.4);
    expect(whilePaused.error).toBeDefined();
  });

  it("rejects progress moving backwards", () => {
    let job = start(createDownloadJob("job_1", source(), "p")).job;
    job = progress(job, 0.6).job;
    const backwards = progress(job, 0.3);
    expect(backwards.error).toBeDefined();
    expect(backwards.job.progress).toBe(0.6); // unchanged
  });

  it("rejects out-of-range progress", () => {
    const job = start(createDownloadJob("job_1", source(), "p")).job;
    expect(progress(job, -0.1).error).toBeDefined();
    expect(progress(job, 1.1).error).toBeDefined();
  });

  it("supports pause and resume without changing the attempt count", () => {
    let job = start(createDownloadJob("job_1", source(), "p")).job;
    job = pause(job).job;
    expect(job.state).toBe("paused");
    job = resume(job).job;
    expect(job.state).toBe("running");
    expect(job.attempt).toBe(1);
  });

  it("cancel is terminal: no further transitions are legal afterwards", () => {
    let job = start(createDownloadJob("job_1", source(), "p")).job;
    const cancelled = cancel(job);
    expect(cancelled.error).toBeUndefined();
    job = cancelled.job;
    expect(job.state).toBe("cancelled");
    expect(job.cancelled).toBe(true);

    expect(start(job).error).toBeDefined();
    expect(progress(job, 0.5).error).toBeDefined();
    expect(pause(job).error).toBeDefined();
    expect(resume(job).error).toBeDefined();
    expect(cancel(job).error).toBeDefined();
    expect(fail(job, networkError()).error).toBeDefined();
    expect(complete(job).error).toBeDefined();
    expect(retry(job).error).toBeDefined();
  });

  it("complete is terminal", () => {
    let job = start(createDownloadJob("job_1", source(), "p")).job;
    job = complete(job).job;
    expect(cancel(job).error).toBeDefined();
    expect(retry(job).error).toBeDefined();
    expect(start(job).error).toBeDefined();
  });

  it("fail records the structured error and retry increments the attempt count", () => {
    let job = start(createDownloadJob("job_1", source(), "p")).job; // attempt 1
    job = progress(job, 0.3).job;
    const failed = fail(job, networkError("connection dropped"));
    expect(failed.error).toBeUndefined();
    job = failed.job;
    expect(job.state).toBe("failed");
    expect(job.lastError?.code).toBe("CONNECTOR_NETWORK");

    const retried = retry(job);
    expect(retried.error).toBeUndefined();
    job = retried.job;
    expect(job.state).toBe("running");
    expect(job.attempt).toBe(2); // incremented
    expect(job.progress).toBe(0); // reset for the new attempt
    expect(job.lastError).toBeUndefined(); // cleared

    // retrying a second time keeps incrementing
    const failedAgain = fail(job, networkError()).job;
    const retriedAgain = retry(failedAgain).job;
    expect(retriedAgain.attempt).toBe(3);
  });

  it("retry is illegal from any state other than failed", () => {
    const pending = createDownloadJob("job_1", source(), "p");
    expect(retry(pending).error).toBeDefined();

    const running = start(pending).job;
    expect(retry(running).error).toBeDefined();
  });

  it("never mutates the input job object", () => {
    const job = createDownloadJob("job_1", source(), "p");
    const snapshot = { ...job };
    start(job);
    expect(job).toEqual(snapshot);
  });
});

function pauseAfterStart(job: ReturnType<typeof createDownloadJob>) {
  const running = start(job).job;
  return pause(running);
}
