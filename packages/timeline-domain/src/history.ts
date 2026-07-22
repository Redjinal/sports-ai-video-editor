// Undo/redo command history (timeline-domain.md §33).
//
// Immutable and deterministic: each transition returns a new history value. A command that
// throws never enters history (the caller keeps the prior value). Undo/redo do not depend on
// selection or any UI state — they replay stored commands and their inverses.
import { applyCommand, type CommandContext, type TimelineCommand } from "./commands";
import type { Sequence } from "./model";

export interface HistoryEntry {
  command: TimelineCommand;
  inverse: TimelineCommand;
  label?: string;
}

export interface TimelineHistory {
  sequence: Sequence;
  /** Applied commands, oldest first; the last is the next to undo. */
  past: HistoryEntry[];
  /** Undone commands; the last is the next to redo. */
  future: HistoryEntry[];
}

export function createHistory(sequence: Sequence): TimelineHistory {
  return { sequence, past: [], future: [] };
}

export function canUndo(history: TimelineHistory): boolean {
  return history.past.length > 0;
}

export function canRedo(history: TimelineHistory): boolean {
  return history.future.length > 0;
}

/**
 * Apply a command and record it. Throws (leaving `history` untouched) if the command is
 * invalid, so a failed command never enters history. Executing a new command clears the
 * redo stack.
 */
export function execute(
  history: TimelineHistory,
  command: TimelineCommand,
  ctx?: CommandContext,
): TimelineHistory {
  const { sequence, inverse } = applyCommand(history.sequence, command, ctx);
  const entry: HistoryEntry = command.meta.label
    ? { command, inverse, label: command.meta.label }
    : { command, inverse };
  return { sequence, past: [...history.past, entry], future: [] };
}

/** Undo the most recent command. A no-op (same value) when there is nothing to undo. */
export function undo(history: TimelineHistory, ctx?: CommandContext): TimelineHistory {
  const entry = history.past[history.past.length - 1];
  if (!entry) return history;
  const { sequence } = applyCommand(history.sequence, entry.inverse, ctx);
  return {
    sequence,
    past: history.past.slice(0, -1),
    future: [...history.future, entry],
  };
}

/** Redo the most recently undone command. A no-op when there is nothing to redo. */
export function redo(history: TimelineHistory, ctx?: CommandContext): TimelineHistory {
  const entry = history.future[history.future.length - 1];
  if (!entry) return history;
  const { sequence } = applyCommand(history.sequence, entry.command, ctx);
  return {
    sequence,
    past: [...history.past, entry],
    future: history.future.slice(0, -1),
  };
}

/** Human-readable labels of the next undo/redo, for UI affordances. */
export function undoLabel(history: TimelineHistory): string | undefined {
  return history.past[history.past.length - 1]?.label;
}
export function redoLabel(history: TimelineHistory): string | undefined {
  return history.future[history.future.length - 1]?.label;
}
