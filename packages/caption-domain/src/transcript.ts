// Transcript model: ordered, non-overlapping segments with optional word-level timing.
//
// A transcript produced by AI transcription is a PROPOSAL until the user reviews/corrects it
// (see transcript-operations.ts) — this module only defines the shape and validation, never a
// concrete transcription provider (that is a later, separately-approved adapter decision).
import { z } from "zod";
import type { Ticks } from "@sve/timeline-domain";

export interface Word {
  text: string;
  startTicks: Ticks;
  endTicks: Ticks;
}

export interface TranscriptSegment {
  id: string;
  speakerId: string;
  startTicks: Ticks;
  endTicks: Ticks;
  text: string;
  /** Word-level timing, when the source (or a later alignment pass) provides it. */
  words?: Word[];
}

export interface Speaker {
  id: string;
  /** User-editable display name (rename supported, see renameSpeaker). */
  displayName: string;
}

export interface Transcript {
  /** Ordered by startTicks; non-overlapping. */
  segments: TranscriptSegment[];
  speakers: Speaker[];
}

const tickSchema = z.number().int().nonnegative();

const wordSchema = z.object({
  text: z.string(),
  startTicks: tickSchema,
  endTicks: tickSchema,
});

const transcriptSegmentSchema = z
  .object({
    id: z.string().min(1),
    speakerId: z.string().min(1),
    startTicks: tickSchema,
    endTicks: tickSchema,
    text: z.string(),
    words: z.array(wordSchema).optional(),
  })
  .refine((s) => s.endTicks > s.startTicks, "segment endTicks must be > startTicks");

const speakerSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
});

export const transcriptSchema = z.object({
  segments: z.array(transcriptSegmentSchema),
  speakers: z.array(speakerSchema),
});

/** Validate an untrusted transcript payload into a typed Transcript (branded ticks). */
export function parseTranscript(input: unknown): Transcript {
  return transcriptSchema.parse(input) as unknown as Transcript;
}

/** True when segments are ordered by startTicks and no two segments overlap. */
export function transcriptIsWellOrdered(transcript: Transcript): boolean {
  const { segments } = transcript;
  for (let i = 1; i < segments.length; i++) {
    const prev = segments[i - 1];
    const cur = segments[i];
    if (!prev || !cur) continue;
    if (cur.startTicks < prev.startTicks) return false;
    if (cur.startTicks < prev.endTicks) return false; // overlap
  }
  return true;
}

/** Look up a segment by id, or undefined if it doesn't exist. */
export function findSegment(
  transcript: Transcript,
  segmentId: string,
): TranscriptSegment | undefined {
  return transcript.segments.find((s) => s.id === segmentId);
}

/** Look up a speaker by id, or undefined if it doesn't exist. */
export function findSpeaker(transcript: Transcript, speakerId: string): Speaker | undefined {
  return transcript.speakers.find((s) => s.id === speakerId);
}
