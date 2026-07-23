// Pure pixel <-> tick geometry for the timeline view.
// The only "math" the UI owns is turning screen pixels into ticks and back; all editing
// arithmetic lives in @sve/timeline-domain. Keeping this pure makes it unit-testable.
import { TIMESCALE, asTicks, type Ticks, type RationalRate } from "@sve/timeline-domain";

export function tickToPx(ticks: number, pxPerSecond: number): number {
  return (ticks / TIMESCALE) * pxPerSecond;
}

export function pxToTicksUnclamped(px: number, pxPerSecond: number): number {
  return (px / pxPerSecond) * TIMESCALE;
}

/** Screen delta (px) -> signed tick delta, rounded to a whole tick. */
export function pxToTickDelta(px: number, pxPerSecond: number): number {
  return Math.round(pxToTicksUnclamped(px, pxPerSecond));
}

/** Absolute x (px) -> non-negative Ticks. */
export function pxToTick(px: number, pxPerSecond: number): Ticks {
  return asTicks(Math.max(0, Math.round(pxToTicksUnclamped(px, pxPerSecond))));
}

/** Ticks per one frame at a rational rate (exact for supported rates). */
export function ticksPerFrame(rate: RationalRate): number {
  return (TIMESCALE * rate.denominator) / rate.numerator;
}

/** Snap a tick value to the nearest whole frame boundary at the sequence's rate. */
export function snapToFrame(ticks: number, rate: RationalRate): Ticks {
  const per = ticksPerFrame(rate);
  return asTicks(Math.max(0, Math.round(ticks / per) * per));
}
