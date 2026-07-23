// Keyframeable transform + interpolation (timeline-domain.md §8, M5).
//
// A visual object carries a Transform. Each animatable channel is either a constant number or a
// list of keyframes; evaluation is a pure function of (channel, tick), so the same transform
// always renders the same value. Non-destructive: keyframes are stored instructions, evaluated
// on demand, never baked into the source.
import { type Ticks, asTicks } from "./ticks";

export type Interpolation = "linear" | "hold" | "ease";

export interface Keyframe {
  atTicks: Ticks;
  value: number;
  /** How the value approaches the NEXT keyframe. */
  interp: Interpolation;
}

/** A channel is a constant, or animated by keyframes (kept sorted by time). */
export type AnimatableNumber = number | { keyframes: Keyframe[] };

export interface Transform {
  /** Position offset from the anchor, in sequence pixels. */
  x: AnimatableNumber;
  y: AnimatableNumber;
  /** Uniform scale, percent (100 = original). */
  scale: AnimatableNumber;
  /** Clockwise rotation in degrees. */
  rotation: AnimatableNumber;
  /** 0..100. */
  opacity: AnimatableNumber;
  /** Anchor as a fraction of the object (0..1); static. */
  anchorX: number;
  anchorY: number;
  /** Crop insets in source pixels; static. */
  cropTop: number;
  cropRight: number;
  cropBottom: number;
  cropLeft: number;
  flipH: boolean;
  flipV: boolean;
  fit: "fit" | "fill" | "stretch";
}

export type TransformChannel = "x" | "y" | "scale" | "rotation" | "opacity";
export const TRANSFORM_CHANNELS: readonly TransformChannel[] = [
  "x",
  "y",
  "scale",
  "rotation",
  "opacity",
];

/** The identity transform: centred, full size, fully opaque, no rotation. */
export function defaultTransform(): Transform {
  return {
    x: 0,
    y: 0,
    scale: 100,
    rotation: 0,
    opacity: 100,
    anchorX: 0.5,
    anchorY: 0.5,
    cropTop: 0,
    cropRight: 0,
    cropBottom: 0,
    cropLeft: 0,
    flipH: false,
    flipV: false,
    fit: "fit",
  };
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Evaluate an animatable channel at `ticks`. A constant returns itself; keyframes are
 * interpolated. Before the first / after the last keyframe the value is held (clamped).
 */
export function evaluateAnimatable(channel: AnimatableNumber, ticks: number): number {
  if (typeof channel === "number") return channel;
  const kfs = channel.keyframes;
  if (kfs.length === 0) return 0;
  if (kfs.length === 1 || ticks <= kfs[0]!.atTicks) return kfs[0]!.value;
  const last = kfs[kfs.length - 1]!;
  if (ticks >= last.atTicks) return last.value;

  // Find the surrounding pair (keyframes are sorted).
  let i = 0;
  while (i < kfs.length - 1 && kfs[i + 1]!.atTicks <= ticks) i += 1;
  const a = kfs[i]!;
  const b = kfs[i + 1]!;
  if (a.interp === "hold") return a.value;
  const span = b.atTicks - a.atTicks;
  const raw = span <= 0 ? 0 : (ticks - a.atTicks) / span;
  const t = a.interp === "ease" ? easeInOut(raw) : raw;
  return a.value + (b.value - a.value) * t;
}

/** Evaluate every animatable channel of a transform at `ticks`. */
export interface EvaluatedTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  anchorX: number;
  anchorY: number;
  cropTop: number;
  cropRight: number;
  cropBottom: number;
  cropLeft: number;
  flipH: boolean;
  flipV: boolean;
  fit: Transform["fit"];
}

export function evaluateTransform(transform: Transform, ticks: number): EvaluatedTransform {
  return {
    x: evaluateAnimatable(transform.x, ticks),
    y: evaluateAnimatable(transform.y, ticks),
    scale: evaluateAnimatable(transform.scale, ticks),
    rotation: evaluateAnimatable(transform.rotation, ticks),
    opacity: evaluateAnimatable(transform.opacity, ticks),
    anchorX: transform.anchorX,
    anchorY: transform.anchorY,
    cropTop: transform.cropTop,
    cropRight: transform.cropRight,
    cropBottom: transform.cropBottom,
    cropLeft: transform.cropLeft,
    flipH: transform.flipH,
    flipV: transform.flipV,
    fit: transform.fit,
  };
}

/** Insert or replace a keyframe on a channel, returning a new AnimatableNumber (sorted). */
export function upsertKeyframe(channel: AnimatableNumber, keyframe: Keyframe): AnimatableNumber {
  const existing = typeof channel === "number" ? [] : channel.keyframes;
  const without = existing.filter((k) => k.atTicks !== keyframe.atTicks);
  const keyframes = [...without, keyframe].sort((a, b) => a.atTicks - b.atTicks);
  return { keyframes };
}

/** Remove the keyframe at `atTicks`; collapses back to a constant when one remains. */
export function removeKeyframe(channel: AnimatableNumber, atTicks: Ticks): AnimatableNumber {
  if (typeof channel === "number") return channel;
  const keyframes = channel.keyframes.filter((k) => k.atTicks !== atTicks);
  if (keyframes.length === 1) return keyframes[0]!.value;
  return { keyframes };
}

/** True when the channel actually animates (more than one keyframe). */
export function isAnimated(channel: AnimatableNumber): boolean {
  return typeof channel !== "number" && channel.keyframes.length > 1;
}

export function kf(atTicks: number, value: number, interp: Interpolation = "linear"): Keyframe {
  return { atTicks: asTicks(atTicks), value, interp };
}
