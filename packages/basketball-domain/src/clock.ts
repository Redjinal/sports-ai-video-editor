// Game-clock <-> timeline-ticks mapping (M8 basketball domain).
// The broadcast game clock counts DOWN within a period (ms remaining) and can stop (fouls,
// timeouts, out-of-bounds) while the timeline keeps rolling. `ClockAnchor`s are checkpoints
// pairing a known game-clock reading with the timeline position it occurred at; between two
// anchors in the same period we interpolate linearly, which is exact for continuously-running
// segments and a reasonable, deterministic estimate across a single stoppage. Outside the
// anchored range for a period, the reading clamps to the nearest anchor rather than
// extrapolating past known data.
import type { Ticks } from "@sve/timeline-domain";
import { asTicks } from "@sve/timeline-domain";

export interface ClockAnchor {
  id: string;
  period: number;
  /** Milliseconds remaining in the period at this anchor. */
  gameClockMs: number;
  /** Timeline position corresponding to that game-clock reading. */
  atTicks: Ticks;
}

export interface GameClockReading {
  period: number;
  gameClockMs: number;
}

/** Anchors for one period, ordered chronologically (descending ms-remaining = ascending ticks). */
function chronologicalAnchorsForPeriod(
  anchors: readonly ClockAnchor[],
  period: number,
): ClockAnchor[] {
  return anchors
    .filter((a) => a.period === period)
    .slice()
    .sort((a, b) => b.gameClockMs - a.gameClockMs);
}

/** Resolve a (period, ms-remaining) game-clock reading to a timeline position. */
export function gameClockToTicks(
  anchors: readonly ClockAnchor[],
  reading: GameClockReading,
): Ticks {
  const periodAnchors = chronologicalAnchorsForPeriod(anchors, reading.period);
  const first = periodAnchors[0];
  if (!first) {
    throw new Error(`gameClockToTicks: no anchors for period ${reading.period}`);
  }
  if (periodAnchors.length === 1) {
    return first.atTicks;
  }

  const last = periodAnchors[periodAnchors.length - 1]!;
  if (reading.gameClockMs >= first.gameClockMs) return first.atTicks;
  if (reading.gameClockMs <= last.gameClockMs) return last.atTicks;

  for (let i = 0; i < periodAnchors.length - 1; i++) {
    const a = periodAnchors[i]!;
    const b = periodAnchors[i + 1]!;
    if (reading.gameClockMs <= a.gameClockMs && reading.gameClockMs >= b.gameClockMs) {
      if (a.gameClockMs === b.gameClockMs) return a.atTicks;
      const frac = (a.gameClockMs - reading.gameClockMs) / (a.gameClockMs - b.gameClockMs);
      return asTicks(Math.round(a.atTicks + frac * (b.atTicks - a.atTicks)));
    }
  }
  // Unreachable: the clamps above cover every value outside [last, first].
  return last.atTicks;
}

/** Resolve a timeline position to the game-clock reading it corresponds to. */
export function ticksToGameClock(
  anchors: readonly ClockAnchor[],
  atTicks: Ticks,
): GameClockReading {
  if (anchors.length === 0) {
    throw new Error("ticksToGameClock: no anchors provided");
  }
  const sorted = anchors.slice().sort((a, b) => a.atTicks - b.atTicks);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;

  if (atTicks <= first.atTicks) return { period: first.period, gameClockMs: first.gameClockMs };
  if (atTicks >= last.atTicks) return { period: last.period, gameClockMs: last.gameClockMs };

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (atTicks < a.atTicks || atTicks > b.atTicks) continue;

    if (a.period !== b.period) {
      // No anchor sits exactly on the period boundary between a and b: attribute the
      // reading to whichever bracketing anchor is chronologically nearer rather than
      // interpolate a game-clock value across a period change.
      const distA = atTicks - a.atTicks;
      const distB = b.atTicks - atTicks;
      return distA <= distB
        ? { period: a.period, gameClockMs: a.gameClockMs }
        : { period: b.period, gameClockMs: b.gameClockMs };
    }
    if (a.atTicks === b.atTicks) return { period: a.period, gameClockMs: a.gameClockMs };
    const frac = (atTicks - a.atTicks) / (b.atTicks - a.atTicks);
    return {
      period: a.period,
      gameClockMs: Math.round(a.gameClockMs - frac * (a.gameClockMs - b.gameClockMs)),
    };
  }
  // Unreachable: the clamps above cover every value outside [first, last].
  return { period: last.period, gameClockMs: last.gameClockMs };
}
