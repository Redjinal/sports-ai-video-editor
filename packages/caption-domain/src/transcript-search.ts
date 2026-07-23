// Deterministic, case-insensitive substring search over a transcript.
import type { Transcript } from "./transcript";

export interface MatchRange {
  /** Character offset into the segment's text, inclusive. */
  start: number;
  /** Character offset into the segment's text, exclusive. */
  end: number;
}

export interface TranscriptSearchResult {
  segmentId: string;
  matchRanges: MatchRange[];
}

/** Case-insensitive, non-overlapping substring search across every segment's text, in transcript
 *  order. Empty queries match nothing. */
export function searchTranscript(transcript: Transcript, query: string): TranscriptSearchResult[] {
  if (query.length === 0) return [];
  const needle = query.toLowerCase();
  const results: TranscriptSearchResult[] = [];
  for (const segment of transcript.segments) {
    const haystack = segment.text.toLowerCase();
    const matchRanges: MatchRange[] = [];
    let fromIndex = 0;
    for (;;) {
      const idx = haystack.indexOf(needle, fromIndex);
      if (idx === -1) break;
      matchRanges.push({ start: idx, end: idx + needle.length });
      fromIndex = idx + needle.length;
    }
    if (matchRanges.length > 0) {
      results.push({ segmentId: segment.id, matchRanges });
    }
  }
  return results;
}
