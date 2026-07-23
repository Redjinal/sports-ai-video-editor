// Provider-neutral caption translation: a proposal model plus a translator INTERFACE only.
//
// CRITICAL: no concrete translation/transcription provider is implemented or referenced here
// (no OpenAI/Whisper/Google/AWS/Deepgram/etc.). CaptionTranslator is a contract a later,
// separately-approved adapter implements. "AI proposes, the user decides": a proposal never
// becomes the track's text until applyTranslation is called on ACCEPTED items.
import type { Caption, CaptionTrack } from "./caption";

export interface TranslationProposalItem {
  captionId: string;
  /** The original lines, kept for diffing/review against the proposal. */
  sourceText: string[];
  /** The proposed replacement lines — untrusted provider output until accepted. */
  proposedText: string[];
  /** Whether the user has accepted this item's proposed text. */
  accepted: boolean;
  /** Whether the user has hand-edited proposedText since it was generated. */
  edited: boolean;
}

export interface TranslationProposal {
  id: string;
  trackId: string;
  /** BCP-47 language tag of the source captions, e.g. "en". */
  sourceLanguage: string;
  /** BCP-47 language tag being proposed, e.g. "es". */
  targetLanguage: string;
  items: TranslationProposalItem[];
}

/**
 * Provider-neutral contract for a captions translator. NO concrete implementation lives in this
 * package — a real adapter (against whichever provider is eventually approved) implements this
 * interface elsewhere. Implementations may be sync or async.
 */
export interface CaptionTranslator {
  translate(input: {
    captions: Caption[];
    sourceLanguage: string;
    targetLanguage: string;
  }): TranslationProposal | Promise<TranslationProposal>;
}

/**
 * Build a translation proposal shell from already-produced per-caption text (e.g. an adapter's
 * normalized translator output). Every item starts unaccepted and unedited — this function makes
 * no acceptance decision itself. Pure; does not call any translator.
 */
export function createTranslationProposal(params: {
  id: string;
  trackId: string;
  sourceLanguage: string;
  targetLanguage: string;
  captions: Caption[];
  proposedTextByCaptionId: ReadonlyMap<string, string[]>;
}): TranslationProposal {
  const items: TranslationProposalItem[] = params.captions.map((cue) => ({
    captionId: cue.id,
    sourceText: cue.lines,
    proposedText: params.proposedTextByCaptionId.get(cue.id) ?? cue.lines,
    accepted: false,
    edited: false,
  }));
  return {
    id: params.id,
    trackId: params.trackId,
    sourceLanguage: params.sourceLanguage,
    targetLanguage: params.targetLanguage,
    items,
  };
}

/**
 * Apply an accepted translation proposal to a caption track, producing a new track. Only items
 * marked `accepted` replace their caption's lines; timing, style, and cue order are preserved
 * exactly. Pure — never mutates the input track or proposal, and never applies unaccepted text.
 */
export function applyTranslation(track: CaptionTrack, proposal: TranslationProposal): CaptionTrack {
  const acceptedTextById = new Map(
    proposal.items
      .filter((item) => item.accepted)
      .map((item) => [item.captionId, item.proposedText]),
  );
  return {
    ...track,
    captions: track.captions.map((cue) => {
      const proposedLines = acceptedTextById.get(cue.id);
      return proposedLines ? { ...cue, lines: proposedLines } : cue;
    }),
  };
}
