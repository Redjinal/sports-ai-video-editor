// Structured errors for malformed caption/transcript input (never a bare throw at a boundary).

export type CaptionFormatErrorCode =
  | "missing-header"
  | "invalid-cue-index"
  | "invalid-cue-block"
  | "invalid-timecode"
  | "invalid-cue-order"
  | "empty-cue-text";

/** Thrown when SRT/VTT text fails to parse. Carries a stable machine-readable `code` in addition
 *  to a human message, so callers can render a safe recovery action instead of a raw stack trace. */
export class CaptionFormatError extends Error {
  readonly code: CaptionFormatErrorCode;

  constructor(code: CaptionFormatErrorCode, message: string) {
    super(message);
    this.name = "CaptionFormatError";
    this.code = code;
  }
}

export type TranscriptErrorCode =
  | "segment-not-found"
  | "speaker-not-found"
  | "invalid-split-point"
  | "segments-not-adjacent"
  | "invalid-selection";

/** Thrown by transcript correction/selection operations on invalid input (unknown ids, split
 *  points outside a segment, non-adjacent merges, ...). */
export class TranscriptError extends Error {
  readonly code: TranscriptErrorCode;

  constructor(code: TranscriptErrorCode, message: string) {
    super(message);
    this.name = "TranscriptError";
    this.code = code;
  }
}
