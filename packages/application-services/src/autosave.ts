// Autosave and recovery scheduling (technical-architecture.md §14).
//
// Policy: snapshot after a short period of inactivity, take a safety snapshot on a fixed
// interval during continuous editing, and always flush before a risky operation
// (export, migration, consolidation, packaging, close).
//
// Platform-neutral by design: timers are injected, so this is unit-testable without a DOM
// and reusable on Android/DeX.

export interface AutosaveTimers {
  setTimeout(handler: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  setInterval(handler: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

export interface AutosaveOptions {
  /** Quiet period after the last edit before an idle snapshot. */
  idleMs?: number;
  /** Safety snapshot cadence while editing continuously. */
  safetyMs?: number;
  /** Performs the actual save. Rejections are reported, never thrown at the caller. */
  save: () => Promise<void>;
  /** Called when a save fails, so the UI can surface it rather than silently losing work. */
  onError?: (error: unknown) => void;
  timers?: AutosaveTimers;
}

export interface AutosaveScheduler {
  /** Record an edit. Starts the idle countdown and the safety cadence. */
  markDirty(): void;
  /** Save now if there are unsaved changes. Use before any risky operation. */
  flush(): Promise<void>;
  /** True when edits have happened since the last completed save. */
  isDirty(): boolean;
  /** Stop all timers. Does not save — call flush() first if that matters. */
  dispose(): void;
}

const DEFAULT_IDLE_MS = 2_000;
const DEFAULT_SAFETY_MS = 30_000;

export function createAutosaveScheduler(options: AutosaveOptions): AutosaveScheduler {
  const idleMs = options.idleMs ?? DEFAULT_IDLE_MS;
  const safetyMs = options.safetyMs ?? DEFAULT_SAFETY_MS;
  const timers: AutosaveTimers = options.timers ?? globalThis;

  let dirty = false;
  let disposed = false;
  let idleHandle: unknown = null;
  let safetyHandle: unknown = null;
  // Serialises saves so a slow write cannot overlap with the next one.
  let inFlight: Promise<void> = Promise.resolve();

  function clearIdle(): void {
    if (idleHandle !== null) {
      timers.clearTimeout(idleHandle);
      idleHandle = null;
    }
  }

  function stopSafety(): void {
    if (safetyHandle !== null) {
      timers.clearInterval(safetyHandle);
      safetyHandle = null;
    }
  }

  function runSave(): Promise<void> {
    if (!dirty || disposed) return inFlight;
    // Clear the flag before saving: edits arriving during the write re-mark it dirty
    // rather than being swallowed by the save that did not include them.
    dirty = false;
    clearIdle();
    inFlight = inFlight
      .then(() => options.save())
      .catch((error: unknown) => {
        // A failed autosave means the work is still unsaved.
        dirty = true;
        options.onError?.(error);
      });
    return inFlight;
  }

  return {
    markDirty(): void {
      if (disposed) return;
      dirty = true;
      clearIdle();
      idleHandle = timers.setTimeout(() => {
        idleHandle = null;
        void runSave();
      }, idleMs);
      if (safetyHandle === null) {
        safetyHandle = timers.setInterval(() => {
          void runSave();
        }, safetyMs);
      }
    },
    flush(): Promise<void> {
      clearIdle();
      return runSave();
    },
    isDirty(): boolean {
      return dirty;
    },
    dispose(): void {
      disposed = true;
      clearIdle();
      stopSafety();
    },
  };
}
