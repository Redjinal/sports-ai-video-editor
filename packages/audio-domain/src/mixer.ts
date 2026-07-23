// Non-destructive audio mixer model: tracks, buses/submixes, and a mix (audio-domain.md — M6).
// Mute/solo resolution and gain composition are pure functions of the mix state; nothing here
// touches an audio engine, a decoder, or any provider SDK.
import { z } from "zod";
import type { Ticks } from "@sve/timeline-domain";
import { audioEnvelopeSchema, evaluateEnvelope, type AudioEnvelope } from "./envelope";
import { dbToGain } from "./gain";

export const audioBusSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  gainDb: z.number(),
  mute: z.boolean(),
});
/** A named submix/bus (e.g. "commentary", "crowd", "music") that tracks route into. */
export type AudioBus = z.infer<typeof audioBusSchema>;

export const audioTrackSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  gainDb: z.number(),
  /** Stereo pan/balance, -1 (full left) to 1 (full right). Not used in gain composition. */
  pan: z.number().min(-1).max(1),
  mute: z.boolean(),
  solo: z.boolean(),
  /** Bus this track routes into. Omitted/absent means the track feeds the master directly. */
  busId: z.string().min(1).optional(),
  /** Optional volume automation for this track. */
  envelope: audioEnvelopeSchema.optional(),
});
export type AudioTrack = z.infer<typeof audioTrackSchema>;

export const mixSchema = z.object({
  masterGainDb: z.number(),
  tracks: z.array(audioTrackSchema),
  buses: z.array(audioBusSchema),
});
/** The full mixer state: tracks, buses/submixes, and a master gain. */
export type Mix = z.infer<typeof mixSchema>;

/** Build a track, keeping optional fields (`busId`, `envelope`) genuinely absent when unset
 *  (required under `exactOptionalPropertyTypes`: an explicit `undefined` is not the same as
 *  an omitted key). */
export function createTrack(input: {
  id: string;
  name: string;
  gainDb?: number;
  pan?: number;
  mute?: boolean;
  solo?: boolean;
  busId?: string;
  envelope?: AudioEnvelope;
}): AudioTrack {
  const track: AudioTrack = {
    id: input.id,
    name: input.name,
    gainDb: input.gainDb ?? 0,
    pan: input.pan ?? 0,
    mute: input.mute ?? false,
    solo: input.solo ?? false,
  };
  if (input.busId !== undefined) track.busId = input.busId;
  if (input.envelope !== undefined) track.envelope = input.envelope;
  return track;
}

function requireTrack(mix: Mix, trackId: string): AudioTrack {
  const track = mix.tracks.find((t) => t.id === trackId);
  if (!track) throw new Error(`Unknown audio track: ${trackId}`);
  return track;
}

function requireBus(mix: Mix, busId: string): AudioBus {
  const bus = mix.buses.find((b) => b.id === busId);
  if (!bus) throw new Error(`Unknown audio bus: ${busId}`);
  return bus;
}

/**
 * Standard mute/solo resolution:
 * - Mute always wins: a muted track, or a track routed into a muted bus, is never audible.
 * - If any track in the mix is soloed, only soloed (and unmuted) tracks are audible —
 *   soloing overrides every other track's audibility even though those tracks aren't muted.
 * - With no solo active, every unmuted track (on an unmuted bus) is audible.
 */
export function isAudible(mix: Mix, trackId: string): boolean {
  const track = requireTrack(mix, trackId);
  if (track.mute) return false;

  const bus = track.busId !== undefined ? requireBus(mix, track.busId) : undefined;
  if (bus?.mute) return false;

  const anySoloed = mix.tracks.some((t) => t.solo);
  if (anySoloed) return track.solo;

  return true;
}

/**
 * Effective linear gain multiplier for a track at a tick: track gain x volume-automation gain
 * x bus gain x master gain. This is pure level composition — it does not account for mute/solo;
 * combine with `isAudible` at the playback boundary (`isAudible(mix, id) ? effectiveGain(...) : 0`).
 */
export function effectiveGain(mix: Mix, trackId: string, atTicks: Ticks): number {
  const track = requireTrack(mix, trackId);
  const bus = track.busId !== undefined ? requireBus(mix, track.busId) : undefined;

  const trackGain = dbToGain(track.gainDb);
  const automationGain = track.envelope ? dbToGain(evaluateEnvelope(track.envelope, atTicks)) : 1;
  const busGain = bus ? dbToGain(bus.gainDb) : 1;
  const masterGain = dbToGain(mix.masterGainDb);

  return trackGain * automationGain * busGain * masterGain;
}
