// Clip-level gain overlay (audio-domain.md — M6). Lets a specific clip be quieter/louder,
// or carry its own fade, without touching the track it sits on. Keyed by timeline object id,
// so this is purely additive state that layers on top of the mixer's track-level gain.
import { z } from "zod";
import type { Ticks } from "@sve/timeline-domain";
import { audioEnvelopeSchema, evaluateEnvelope, type AudioEnvelope } from "./envelope";
import { dbToGain } from "./gain";

export const clipAudioOverlaySchema = z.object({
  /** Id of the timeline clip/object this overlay applies to. */
  objectId: z.string().min(1),
  /** Constant gain trim in decibels, applied on top of the track. */
  gainDb: z.number().optional(),
  /** Optional per-clip volume automation / fade (e.g. a clip-local fade in/out). */
  envelope: audioEnvelopeSchema.optional(),
});
export type ClipAudioOverlay = z.infer<typeof clipAudioOverlaySchema>;

/** Overlays keyed by the timeline object id they apply to. */
export type ClipAudioOverlayMap = Readonly<Record<string, ClipAudioOverlay>>;

/** Build an overlay, keeping optional fields genuinely absent when unset. */
export function createClipOverlay(input: {
  objectId: string;
  gainDb?: number;
  envelope?: AudioEnvelope;
}): ClipAudioOverlay {
  const overlay: ClipAudioOverlay = { objectId: input.objectId };
  if (input.gainDb !== undefined) overlay.gainDb = input.gainDb;
  if (input.envelope !== undefined) overlay.envelope = input.envelope;
  return overlay;
}

/** Look up the overlay for a clip, if any. */
export function findClipOverlay(
  overlays: ClipAudioOverlayMap,
  objectId: string,
): ClipAudioOverlay | undefined {
  return overlays[objectId];
}

/** Linear gain multiplier contributed by a clip overlay at a tick. No overlay -> unity (1). */
export function clipOverlayGain(overlay: ClipAudioOverlay | undefined, atTicks: Ticks): number {
  if (!overlay) return 1;
  const staticGain = overlay.gainDb !== undefined ? dbToGain(overlay.gainDb) : 1;
  const envelopeGain = overlay.envelope ? dbToGain(evaluateEnvelope(overlay.envelope, atTicks)) : 1;
  return staticGain * envelopeGain;
}
