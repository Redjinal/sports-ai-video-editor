// Display-only clock and period formatting for broadcast graphics.
// These strings are derived, never authoritative — the authoritative game/shot clock
// values remain plain milliseconds on `ScoreboardState`.

/**
 * Format a game clock in milliseconds as a broadcast-style clock string.
 * At or above one minute: `M:SS` (e.g. 65_000ms -> "1:05").
 * Under one minute: `SS.s` with one decimal place (e.g. 9_500ms -> "9.5").
 */
export function formatGameClock(gameClockMs: number): string {
  const clampedMs = Math.max(0, gameClockMs);
  const totalSeconds = clampedMs / 1000;
  if (totalSeconds >= 60) {
    const totalWholeSeconds = Math.floor(totalSeconds);
    const minutes = Math.floor(totalWholeSeconds / 60);
    const seconds = totalWholeSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }
  return totalSeconds.toFixed(1);
}

/**
 * Format a shot clock in milliseconds as whole seconds remaining, rounded up so the
 * display never reads a lower count than time actually remaining (matches broadcast
 * shot-clock convention of counting down to "1" before expiring).
 */
export function formatShotClock(shotClockMs: number): string {
  const clampedMs = Math.max(0, shotClockMs);
  return String(Math.ceil(clampedMs / 1000));
}

const ORDINAL_PERIOD_LABELS = ["1st", "2nd", "3rd", "4th"] as const;

/** Format a 1-based period index as a broadcast label, e.g. "1st".."4th", "OT", "2OT". */
export function formatPeriodLabel(period: number): string {
  if (!Number.isInteger(period) || period < 1) {
    throw new RangeError(`period must be a positive integer, got ${period}`);
  }
  if (period <= ORDINAL_PERIOD_LABELS.length) {
    // Non-null: guarded by the length check above.
    return ORDINAL_PERIOD_LABELS[period - 1] as string;
  }
  const overtimeNumber = period - ORDINAL_PERIOD_LABELS.length;
  return overtimeNumber === 1 ? "OT" : `${overtimeNumber}OT`;
}
