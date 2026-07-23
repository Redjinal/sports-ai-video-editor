// Pure transcript correction operations. Every function returns a NEW Transcript and never
// mutates its input — these are the user's editorial corrections on top of an AI proposal
// (edit text, split, merge, reassign speaker, rename speaker).
import type { Ticks } from "@sve/timeline-domain";
import { TranscriptError } from "./errors";
import type { Speaker, Transcript, TranscriptSegment, Word } from "./transcript";
import { findSegment, findSpeaker } from "./transcript";

function requireSegment(transcript: Transcript, segmentId: string): TranscriptSegment {
  const segment = findSegment(transcript, segmentId);
  if (!segment) {
    throw new TranscriptError("segment-not-found", `Segment "${segmentId}" not found`);
  }
  return segment;
}

function requireSpeaker(transcript: Transcript, speakerId: string): Speaker {
  const speaker = findSpeaker(transcript, speakerId);
  if (!speaker) {
    throw new TranscriptError("speaker-not-found", `Speaker "${speakerId}" not found`);
  }
  return speaker;
}

function replaceSegment(
  transcript: Transcript,
  segmentId: string,
  replacement: TranscriptSegment[],
): Transcript {
  const index = transcript.segments.findIndex((s) => s.id === segmentId);
  if (index === -1) {
    throw new TranscriptError("segment-not-found", `Segment "${segmentId}" not found`);
  }
  const segments = [
    ...transcript.segments.slice(0, index),
    ...replacement,
    ...transcript.segments.slice(index + 1),
  ];
  return { ...transcript, segments };
}

/** Edit a segment's transcribed text (a correction to the AI proposal). Timing is untouched. */
export function editSegmentText(
  transcript: Transcript,
  segmentId: string,
  newText: string,
): Transcript {
  const segment = requireSegment(transcript, segmentId);
  return replaceSegment(transcript, segmentId, [{ ...segment, text: newText }]);
}

function wordsToText(words: Word[]): string {
  return words.map((w) => w.text).join(" ");
}

/**
 * Split a segment into two at `atTicks`, which must fall strictly inside the segment.
 *
 * When the segment has word-level timing, `atTicks` must land exactly on a word boundary (the
 * startTicks of some non-first word) so the split is unambiguous; the words before it become the
 * left segment, the rest become the right segment. Without word timing, the split point is
 * mapped to the nearest whitespace boundary in the text proportionally to elapsed time — a
 * best-effort, still-deterministic split.
 */
export function splitSegment(
  transcript: Transcript,
  segmentId: string,
  atTicks: Ticks,
  newSegmentId: string,
): Transcript {
  const segment = requireSegment(transcript, segmentId);
  if (atTicks <= segment.startTicks || atTicks >= segment.endTicks) {
    throw new TranscriptError(
      "invalid-split-point",
      `Split point ${atTicks} must be strictly inside segment "${segmentId}" (${segment.startTicks}..${segment.endTicks})`,
    );
  }

  if (segment.words && segment.words.length > 0) {
    const words = segment.words;
    const splitIndex = words.findIndex((w) => w.startTicks === atTicks);
    if (splitIndex <= 0) {
      throw new TranscriptError(
        "invalid-split-point",
        `Split point ${atTicks} does not align with a word boundary in segment "${segmentId}"`,
      );
    }
    const leftWords = words.slice(0, splitIndex);
    const rightWords = words.slice(splitIndex);
    const left: TranscriptSegment = {
      ...segment,
      id: segment.id,
      endTicks: atTicks,
      text: wordsToText(leftWords),
      words: leftWords,
    };
    const right: TranscriptSegment = {
      ...segment,
      id: newSegmentId,
      startTicks: atTicks,
      text: wordsToText(rightWords),
      words: rightWords,
    };
    return replaceSegment(transcript, segmentId, [left, right]);
  }

  // No word timing: split the text at the whitespace boundary closest to the time-proportional
  // character offset, keeping the split deterministic and reproducible.
  const words = segment.text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 2) {
    throw new TranscriptError(
      "invalid-split-point",
      `Segment "${segmentId}" has no word timing and too little text to split`,
    );
  }
  const ratio = (atTicks - segment.startTicks) / (segment.endTicks - segment.startTicks);
  const wordSplitIndex = Math.min(Math.max(Math.round(words.length * ratio), 1), words.length - 1);
  const leftText = words.slice(0, wordSplitIndex).join(" ");
  const rightText = words.slice(wordSplitIndex).join(" ");
  const left: TranscriptSegment = { ...segment, endTicks: atTicks, text: leftText };
  const right: TranscriptSegment = {
    ...segment,
    id: newSegmentId,
    startTicks: atTicks,
    text: rightText,
  };
  return replaceSegment(transcript, segmentId, [left, right]);
}

/**
 * Merge two adjacent segments (consecutive in transcript order, first's end touching second's
 * start) into one. The merged segment keeps the first segment's id and speaker, spans both
 * segments' time, and concatenates their text. Word timing is only kept if both segments have it.
 */
export function mergeSegments(
  transcript: Transcript,
  firstSegmentId: string,
  secondSegmentId: string,
): Transcript {
  const firstIndex = transcript.segments.findIndex((s) => s.id === firstSegmentId);
  const secondIndex = transcript.segments.findIndex((s) => s.id === secondSegmentId);
  if (firstIndex === -1) {
    throw new TranscriptError("segment-not-found", `Segment "${firstSegmentId}" not found`);
  }
  if (secondIndex === -1) {
    throw new TranscriptError("segment-not-found", `Segment "${secondSegmentId}" not found`);
  }
  if (secondIndex !== firstIndex + 1) {
    throw new TranscriptError(
      "segments-not-adjacent",
      `Segments "${firstSegmentId}" and "${secondSegmentId}" are not adjacent in the transcript`,
    );
  }
  const first = transcript.segments[firstIndex];
  const second = transcript.segments[secondIndex];
  if (!first || !second) {
    throw new TranscriptError("segment-not-found", "Segment lookup failed unexpectedly");
  }
  const merged: TranscriptSegment = {
    id: first.id,
    speakerId: first.speakerId,
    startTicks: first.startTicks,
    endTicks: second.endTicks,
    text: [first.text, second.text].filter((t) => t.length > 0).join(" "),
    ...(first.words && second.words ? { words: [...first.words, ...second.words] } : {}),
  };
  const segments = [
    ...transcript.segments.slice(0, firstIndex),
    merged,
    ...transcript.segments.slice(secondIndex + 1),
  ];
  return { ...transcript, segments };
}

/** Reassign a segment to a different (already-known) speaker. */
export function reassignSpeaker(
  transcript: Transcript,
  segmentId: string,
  newSpeakerId: string,
): Transcript {
  requireSegment(transcript, segmentId);
  requireSpeaker(transcript, newSpeakerId);
  return {
    ...transcript,
    segments: transcript.segments.map((s) =>
      s.id === segmentId ? { ...s, speakerId: newSpeakerId } : s,
    ),
  };
}

/** Rename a speaker (display name only; the speaker id and all segment references are stable). */
export function renameSpeaker(
  transcript: Transcript,
  speakerId: string,
  newDisplayName: string,
): Transcript {
  requireSpeaker(transcript, speakerId);
  return {
    ...transcript,
    speakers: transcript.speakers.map((sp) =>
      sp.id === speakerId ? { ...sp, displayName: newDisplayName } : sp,
    ),
  };
}
