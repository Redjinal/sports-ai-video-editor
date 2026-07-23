// Volume automation envelopes and fades (audio-domain.md — M6 mixer).
// An envelope is either a constant dB value or a sparse set of (tick, dB) keyframes.
// Evaluation is a pure function of time: no mutation, no I/O, deterministic.
//
// This module intentionally defines its own keyframe/envelope types rather than importing
// a transform module from timeline-domain (none exists on this branch).
import { z } from "zod";
import { addTicks, type Ticks } from "@sve/timeline-domain";
import { dbToGain, gainToDb } from "./gain";

export const envelopePointSchema = z.object({
  atTicks: z.number().int().nonnegative(),
  /** Gain at this point, in decibels. May be -Infinity to represent silence. */
  db: z.number(),
});
export type EnvelopePoint = z.infer<typeof envelopePointSchema>;

export const audioEnvelopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("constant"), db: z.number() }),
  z.object({ kind: z.literal("points"), points: z.array(envelopePointSchema).min(1) }),
]);
/** A volume automation envelope: a fixed dB level, or a piecewise-linear dB curve over time. */
export type AudioEnvelope = z.infer<typeof audioEnvelopeSchema>;

/** Build a constant-level envelope. */
export function constantEnvelope(db: number): AudioEnvelope {
  return { kind: "constant", db };
}

/** Build a keyframed envelope from points (order does not matter; evaluation sorts). */
export function pointsEnvelope(points: EnvelopePoint[]): AudioEnvelope {
  return { kind: "points", points };
}

/**
 * Evaluate an envelope at a tick, returning the level in decibels.
 *
 * - A `constant` envelope returns its fixed dB value everywhere.
 * - A `points` envelope is held at the first/last point's value outside its span (clamped),
 *   and linearly interpolated between the two bracketing points inside it.
 *
 * Interpolation is normally linear in the dB domain (matches how points are authored). When a
 * bracketing point is non-finite (i.e. -Infinity dB, silence), dB-domain interpolation would
 * produce -Infinity/NaN for the whole segment, so that segment is interpolated in linear-gain
 * space instead and converted back to dB. This is what makes fade-in/fade-out (which anchor on
 * -Infinity dB) behave as a smooth gain ramp rather than jumping straight to silence.
 */
export function evaluateEnvelope(env: AudioEnvelope, atTicks: Ticks): number {
  if (env.kind === "constant") return env.db;

  const points = [...env.points].sort((a, b) => a.atTicks - b.atTicks);
  const first = points[0]!;
  if (atTicks <= first.atTicks) return first.db;

  const last = points[points.length - 1]!;
  if (atTicks >= last.atTicks) return last.db;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i]!;
    const p1 = points[i + 1]!;
    if (atTicks >= p0.atTicks && atTicks <= p1.atTicks) {
      return interpolateSegment(p0, p1, atTicks);
    }
  }
  // Unreachable given the clamps above, but keeps the function total.
  return last.db;
}

function interpolateSegment(p0: EnvelopePoint, p1: EnvelopePoint, atTicks: Ticks): number {
  const span = p1.atTicks - p0.atTicks;
  if (span <= 0) return p1.db;
  const t = (atTicks - p0.atTicks) / span;

  if (!Number.isFinite(p0.db) || !Number.isFinite(p1.db)) {
    const g0 = dbToGain(p0.db);
    const g1 = dbToGain(p1.db);
    return gainToDb(g0 + (g1 - g0) * t);
  }
  return p0.db + (p1.db - p0.db) * t;
}

/** A linear gain ramp from silence up to `targetDb` (default unity/0 dB) over [startTicks, startTicks + durationTicks). */
export function fadeIn(startTicks: Ticks, durationTicks: Ticks, targetDb = 0): AudioEnvelope {
  const endAt = addTicks(startTicks, durationTicks);
  return pointsEnvelope([
    { atTicks: startTicks, db: Number.NEGATIVE_INFINITY },
    { atTicks: endAt, db: targetDb },
  ]);
}

/** A linear gain ramp from `fromDb` (default unity/0 dB) down to silence over [startTicks, startTicks + durationTicks). */
export function fadeOut(startTicks: Ticks, durationTicks: Ticks, fromDb = 0): AudioEnvelope {
  const endAt = addTicks(startTicks, durationTicks);
  return pointsEnvelope([
    { atTicks: startTicks, db: fromDb },
    { atTicks: endAt, db: Number.NEGATIVE_INFINITY },
  ]);
}

export interface Crossfade {
  /** Envelope for the outgoing clip/track: fades out across the overlap. */
  outgoing: AudioEnvelope;
  /** Envelope for the incoming clip/track: fades in across the overlap. */
  incoming: AudioEnvelope;
}

/** A pair of complementary fade envelopes covering an overlap region, non-destructive. */
export function crossfade(startTicks: Ticks, durationTicks: Ticks): Crossfade {
  return {
    outgoing: fadeOut(startTicks, durationTicks),
    incoming: fadeIn(startTicks, durationTicks),
  };
}
