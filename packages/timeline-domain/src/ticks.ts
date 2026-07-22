// Canonical timeline time (timeline-domain.md §2, DEC-EDIT-009).
// Authoritative time is INTEGER ticks at 27,000,000 ticks/second. Never float seconds.
// 27,000,000 is divisible by common frame durations (24, 25, 30, 50, 60, and the
// 1001-based 23.976/29.97/59.94 rates), so frame boundaries land on exact ticks.

/** Branded integer-tick type so seconds/frames can't be passed where ticks are expected. */
export type Ticks = number & { readonly __ticks: unique symbol };

export const TIMESCALE = 27_000_000 as const;

/** Construct a Ticks value, asserting it is a non-negative safe integer. */
export function asTicks(value: number): Ticks {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Ticks must be a safe integer, got ${value}`);
  }
  if (value < 0) {
    throw new RangeError(`Ticks must be non-negative, got ${value}`);
  }
  return value as Ticks;
}

export const ZERO_TICKS = asTicks(0);

export function addTicks(a: Ticks, b: Ticks): Ticks {
  return asTicks(a + b);
}

/** Subtract; throws if the result would be negative (durations are non-negative). */
export function subTicks(a: Ticks, b: Ticks): Ticks {
  return asTicks(a - b);
}

/** Exclusive end boundary of an object occupying [start, start+duration). */
export function endTicks(start: Ticks, duration: Ticks): Ticks {
  return addTicks(start, duration);
}

export interface RationalRate {
  numerator: number;
  denominator: number;
}

/** Common broadcast/production frame rates. 1001-based rates are never rounded. */
export const FRAME_RATES = {
  fps24: { numerator: 24, denominator: 1 },
  fps25: { numerator: 25, denominator: 1 },
  fps30: { numerator: 30, denominator: 1 },
  fps50: { numerator: 50, denominator: 1 },
  fps60: { numerator: 60, denominator: 1 },
  fps23_976: { numerator: 24000, denominator: 1001 },
  fps29_97: { numerator: 30000, denominator: 1001 },
  fps59_94: { numerator: 60000, denominator: 1001 },
} as const satisfies Record<string, RationalRate>;

/** Ticks per single frame at a rational rate. Exact for all FRAME_RATES entries. */
export function ticksPerFrame(rate: RationalRate): number {
  // ticks/frame = TIMESCALE * (denominator / numerator)
  return (TIMESCALE * rate.denominator) / rate.numerator;
}

/** Convert a frame index to its exact start tick. */
export function frameToTicks(frame: number, rate: RationalRate): Ticks {
  if (!Number.isInteger(frame)) {
    throw new RangeError(`frame must be an integer, got ${frame}`);
  }
  return asTicks(Math.round(frame * ticksPerFrame(rate)));
}

/** Floor a tick value to the frame index containing it. */
export function ticksToFrame(t: Ticks, rate: RationalRate): number {
  return Math.floor(t / ticksPerFrame(rate));
}

/** Derived seconds for display only — never persisted as authoritative time. */
export function ticksToSeconds(t: Ticks): number {
  return t / TIMESCALE;
}
