// Timeline editing state for the UI, backed by the @sve/timeline-domain command history.
//
// The view never computes edits: it builds a domain command and calls run()/an operation,
// which goes through history.execute so undo/redo and atomicity come from the kernel. A
// command that the domain rejects (collision, locked track, ...) is surfaced via onError and
// leaves state unchanged — it never enters history.
import { useCallback, useReducer, useRef } from "react";
import {
  createHistory,
  execute,
  undo as undoHistory,
  redo as redoHistory,
  canUndo,
  canRedo,
  buildRippleDelete,
  type Sequence,
  type TimelineCommand,
  type CommandContext,
  type CommandMeta,
  type TimelineHistory,
} from "@sve/timeline-domain";

export interface UseTimelineOptions {
  onChange?: (sequence: Sequence) => void;
  onError?: (message: string) => void;
  context?: CommandContext;
}

let counter = 0;
/** A unique, deterministic-per-call command meta. */
export function nextMeta(sequenceId: string, label?: string): CommandMeta {
  counter += 1;
  const id = `cmd_${Date.now().toString(36)}_${counter}`;
  return label
    ? { id, version: 1, sequenceId, timestamp: new Date().toISOString(), label }
    : { id, version: 1, sequenceId, timestamp: new Date().toISOString() };
}

export interface TimelineApi {
  sequence: Sequence;
  selectedId: string | null;
  playheadTicks: number;
  canUndo: boolean;
  canRedo: boolean;
  select: (id: string | null) => void;
  setPlayhead: (ticks: number) => void;
  /** Run a domain command through history. Returns whether it applied. */
  run: (command: TimelineCommand) => boolean;
  rippleDelete: (objectId: string) => void;
  undo: () => void;
  redo: () => void;
}

function describe(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as Error).message);
  return String(e);
}

export function useTimeline(initial: Sequence, opts: UseTimelineOptions = {}): TimelineApi {
  // Seeded once. This hook owns the editing session as the source of truth; feeding the
  // edited sequence back in must NOT reset history. Callers load a different sequence by
  // remounting the component (React `key`), e.g. keyed on the open project.
  const historyRef = useRef<TimelineHistory>(createHistory(initial));
  const selectedRef = useRef<string | null>(null);
  const playheadRef = useRef<number>(0);
  const [, force] = useReducer((n: number) => n + 1, 0);

  const optsRef = useRef(opts);
  optsRef.current = opts;

  const commit = useCallback((h: TimelineHistory) => {
    historyRef.current = h;
    optsRef.current.onChange?.(h.sequence);
    force();
  }, []);

  const run = useCallback(
    (command: TimelineCommand): boolean => {
      try {
        commit(execute(historyRef.current, command, optsRef.current.context));
        return true;
      } catch (e) {
        optsRef.current.onError?.(describe(e));
        return false;
      }
    },
    [commit],
  );

  const rippleDelete = useCallback(
    (objectId: string) => {
      const seq = historyRef.current.sequence;
      const batch = buildRippleDelete(seq, { objectId }, nextMeta(seq.id, "Ripple delete"));
      if (run(batch) && selectedRef.current === objectId) {
        selectedRef.current = null;
      }
    },
    [run],
  );

  const undo = useCallback(() => {
    if (!canUndo(historyRef.current)) return;
    commit(undoHistory(historyRef.current, optsRef.current.context));
  }, [commit]);

  const redo = useCallback(() => {
    if (!canRedo(historyRef.current)) return;
    commit(redoHistory(historyRef.current, optsRef.current.context));
  }, [commit]);

  const select = useCallback((id: string | null) => {
    selectedRef.current = id;
    force();
  }, []);

  const setPlayhead = useCallback((ticks: number) => {
    playheadRef.current = Math.max(0, ticks);
    force();
  }, []);

  return {
    sequence: historyRef.current.sequence,
    selectedId: selectedRef.current,
    playheadTicks: playheadRef.current,
    canUndo: canUndo(historyRef.current),
    canRedo: canRedo(historyRef.current),
    select,
    setPlayhead,
    run,
    rippleDelete,
    undo,
    redo,
  };
}
