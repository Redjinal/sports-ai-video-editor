// Chunk a transcript into readable caption cues. Pure and deterministic: the same transcript and
// options always produce the same CaptionTrack.
import { asTicks, type Ticks } from "@sve/timeline-domain";
import {
  DEFAULT_CAPTION_STYLE,
  type Caption,
  type CaptionStyle,
  type CaptionTrack,
} from "./caption";
import type { Transcript, TranscriptSegment, Word } from "./transcript";

export interface TranscriptToCaptionsOptions {
  /** Maximum characters per displayed line (word-wrapped; a single overlong word is never split). */
  maxCharsPerLine: number;
  /** Maximum number of lines per cue. */
  maxLines: number;
  /** Cues shorter than this are extended, without overlapping the next cue. */
  minDurationTicks: Ticks;
  /** A block of lines that would exceed this duration starts a new cue instead. */
  maxDurationTicks: Ticks;
  /** Default style for the produced track; falls back to DEFAULT_CAPTION_STYLE. */
  style?: CaptionStyle;
  /** Id for the produced track; defaults to "captions". */
  trackId?: string;
}

type Atom = Word;

function atomsForSegment(segment: TranscriptSegment): Atom[] {
  if (segment.words && segment.words.length > 0) return segment.words;
  const words = segment.text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];
  const duration = segment.endTicks - segment.startTicks;
  const atoms: Atom[] = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word === undefined) continue;
    const start = segment.startTicks + Math.round((i / words.length) * duration);
    const end = segment.startTicks + Math.round(((i + 1) / words.length) * duration);
    atoms.push({ text: word, startTicks: asTicks(start), endTicks: asTicks(Math.max(end, start)) });
  }
  return atoms;
}

/**
 * Greedily pack atoms (words) into lines (maxCharsPerLine) and lines into cues (maxLines,
 * maxDurationTicks), in a single pass so a duration overflow can start a new cue even mid-line —
 * a line that individually respects maxCharsPerLine can still span too much time (slow speech).
 *
 * Each atom is handled in three steps: (1) close the current line if it doesn't fit the char
 * limit — and if the cue is already at maxLines, that closed line starts a *new* cue instead of
 * joining the old one; (2) independently, if adding this atom would push the cue's duration past
 * maxDurationTicks, close out whatever has accumulated (line included) as a finished cue; (3)
 * place the atom on the (possibly now-fresh) current line.
 */
function buildCueLineGroups(
  atoms: Atom[],
  maxCharsPerLine: number,
  maxLines: number,
  maxDurationTicks: number,
): Atom[][][] {
  const cues: Atom[][][] = [];
  let committedLines: Atom[][] = [];
  let currentLine: Atom[] = [];
  let currentLineLen = 0;
  let cueStartTicks = 0;

  for (const atom of atoms) {
    // Step 1: char-limit line wrap.
    const candidateLineLen =
      currentLine.length === 0 ? atom.text.length : currentLineLen + 1 + atom.text.length;
    if (currentLine.length > 0 && candidateLineLen > maxCharsPerLine) {
      if (committedLines.length + 1 > maxLines) {
        cues.push(committedLines);
        committedLines = [];
      }
      committedLines.push(currentLine);
      const firstOfCommitted = committedLines[0]?.[0];
      if (committedLines.length === 1 && firstOfCommitted)
        cueStartTicks = firstOfCommitted.startTicks;
      currentLine = [];
      currentLineLen = 0;
    }

    // Step 2: duration limit, independent of the char-based line wrap above — a single line can
    // itself already span too much time.
    const cueHasContent = committedLines.length > 0 || currentLine.length > 0;
    if (cueHasContent && atom.endTicks - cueStartTicks > maxDurationTicks) {
      if (currentLine.length > 0) {
        committedLines.push(currentLine);
        currentLine = [];
        currentLineLen = 0;
      }
      if (committedLines.length > 0) {
        cues.push(committedLines);
        committedLines = [];
      }
    }

    // Step 3: place the atom on the (possibly now-fresh) current line.
    if (committedLines.length === 0 && currentLine.length === 0) {
      cueStartTicks = atom.startTicks;
    }
    const lenIfAdded =
      currentLine.length === 0 ? atom.text.length : currentLineLen + 1 + atom.text.length;
    currentLine.push(atom);
    currentLineLen = lenIfAdded;
  }

  if (currentLine.length > 0) {
    if (committedLines.length + 1 > maxLines) {
      cues.push(committedLines);
      committedLines = [];
    }
    committedLines.push(currentLine);
  }
  if (committedLines.length > 0) cues.push(committedLines);
  return cues;
}

function buildCaption(id: string, lines: Atom[][]): Caption | undefined {
  const allAtoms = lines.flat();
  const firstAtom = allAtoms[0];
  const lastAtom = allAtoms[allAtoms.length - 1];
  if (!firstAtom || !lastAtom) return undefined;
  const lineTexts = lines.map((line) => line.map((a) => a.text).join(" "));
  return {
    id,
    startTicks: asTicks(firstAtom.startTicks),
    endTicks: asTicks(Math.max(lastAtom.endTicks, firstAtom.startTicks + 1)),
    lines: lineTexts,
  };
}

/** Extend cues shorter than minDurationTicks, never past the next cue's original start. */
function applyMinDuration(cues: Caption[], minDurationTicks: Ticks): Caption[] {
  return cues.map((cue, i) => {
    const duration = cue.endTicks - cue.startTicks;
    if (duration >= minDurationTicks) return cue;
    const next = cues[i + 1];
    const desiredEnd = cue.startTicks + minDurationTicks;
    const newEnd = next ? Math.min(desiredEnd, next.startTicks) : desiredEnd;
    return { ...cue, endTicks: asTicks(Math.max(newEnd, cue.endTicks)) };
  });
}

/**
 * Chunk a transcript's segments into readable caption cues, respecting max chars/line, max
 * lines/cue, and min/max cue duration. Deterministic: same input always yields the same output.
 */
export function transcriptToCaptions(
  transcript: Transcript,
  opts: TranscriptToCaptionsOptions,
): CaptionTrack {
  if (opts.maxCharsPerLine < 1) throw new RangeError("maxCharsPerLine must be >= 1");
  if (opts.maxLines < 1) throw new RangeError("maxLines must be >= 1");
  if (opts.minDurationTicks > opts.maxDurationTicks) {
    throw new RangeError("minDurationTicks must be <= maxDurationTicks");
  }

  const rawCues: Caption[] = [];
  let seq = 0;
  for (const segment of transcript.segments) {
    const atoms = atomsForSegment(segment);
    if (atoms.length === 0) continue;
    const cueLineGroups = buildCueLineGroups(
      atoms,
      opts.maxCharsPerLine,
      opts.maxLines,
      opts.maxDurationTicks,
    );
    for (const cueLines of cueLineGroups) {
      const caption = buildCaption(`caption-${seq}`, cueLines);
      if (caption) {
        rawCues.push(caption);
        seq += 1;
      }
    }
  }

  return {
    id: opts.trackId ?? "captions",
    captions: applyMinDuration(rawCues, opts.minDurationTicks),
    defaultStyle: opts.style ?? DEFAULT_CAPTION_STYLE,
  };
}
