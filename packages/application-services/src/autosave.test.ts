import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAutosaveScheduler } from "./autosave";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("autosave scheduler", () => {
  it("saves after the idle period, not on every edit", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const s = createAutosaveScheduler({ save, idleMs: 2000, safetyMs: 30000 });

    s.markDirty();
    s.markDirty();
    s.markDirty();
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2000);
    expect(save).toHaveBeenCalledTimes(1);
    s.dispose();
  });

  it("restarts the idle countdown while the user keeps editing", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const s = createAutosaveScheduler({ save, idleMs: 2000, safetyMs: 30000 });

    s.markDirty();
    await vi.advanceTimersByTimeAsync(1500);
    s.markDirty(); // still typing — countdown resets
    await vi.advanceTimersByTimeAsync(1500);
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledTimes(1);
    s.dispose();
  });

  it("takes a safety snapshot during continuous editing", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const s = createAutosaveScheduler({ save, idleMs: 5000, safetyMs: 10000 });

    // Edit every 4s so the idle timer never fires; the safety interval must still save.
    for (let i = 0; i < 6; i++) {
      s.markDirty();
      await vi.advanceTimersByTimeAsync(4000);
    }
    expect(save.mock.calls.length).toBeGreaterThanOrEqual(2);
    s.dispose();
  });

  it("flush saves immediately and clears the dirty flag", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const s = createAutosaveScheduler({ save, idleMs: 2000, safetyMs: 30000 });

    s.markDirty();
    expect(s.isDirty()).toBe(true);
    await s.flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(s.isDirty()).toBe(false);
    s.dispose();
  });

  it("does nothing when there is nothing to save", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const s = createAutosaveScheduler({ save });
    await s.flush();
    expect(save).not.toHaveBeenCalled();
    s.dispose();
  });

  it("keeps the project dirty and reports when a save fails", async () => {
    const save = vi.fn().mockRejectedValue(new Error("disk full"));
    const onError = vi.fn();
    const s = createAutosaveScheduler({ save, onError, idleMs: 1000, safetyMs: 30000 });

    s.markDirty();
    await vi.advanceTimersByTimeAsync(1000);

    expect(save).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    // A failed autosave must not be mistaken for saved work.
    expect(s.isDirty()).toBe(true);
    s.dispose();
  });

  it("does not lose an edit that arrives while a save is in flight", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const save = vi.fn().mockImplementation(() => gate);
    const s = createAutosaveScheduler({ save, idleMs: 1000, safetyMs: 30000 });

    s.markDirty();
    await vi.advanceTimersByTimeAsync(1000); // save starts, flag cleared
    s.markDirty(); // edit lands mid-write
    release();
    await vi.advanceTimersByTimeAsync(0);

    expect(s.isDirty()).toBe(true); // the new edit is still pending
    s.dispose();
  });

  it("stops scheduling once disposed", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const s = createAutosaveScheduler({ save, idleMs: 1000, safetyMs: 5000 });
    s.markDirty();
    s.dispose();
    await vi.advanceTimersByTimeAsync(10000);
    expect(save).not.toHaveBeenCalled();
  });
});
