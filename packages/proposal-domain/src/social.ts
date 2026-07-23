// Social reframe descriptors (M10 social sequences). Produces a ProposalSequence targeting a
// social aspect ratio, with one "reframe" Proposal per master object carrying a ReframeIntent
// descriptor.
//
// Does NOT compute or apply any visual crop/pan/scale transform: the timeline object model has
// no per-object framing fields on this branch, and that module (actual reframe rendering) is not
// part of this package. `intentFor` below is a structural label only, not a vision decision.
// Master sequence is only ever read.
import {
  endTicks as sourceEndTicks,
  type Sequence,
  type TimelineObject,
} from "@sve/timeline-domain";
import type { Proposal, ProposalSequence, ReframeIntent, SocialAspect } from "./model";
import { createProposalSequence } from "./proposal-sequence";

/** width:height ratio units for each supported social aspect. */
const ASPECT_RATIO: Record<SocialAspect, { w: number; h: number }> = {
  "16:9": { w: 16, h: 9 },
  "9:16": { w: 9, h: 16 },
  "1:1": { w: 1, h: 1 },
  "4:5": { w: 4, h: 5 },
};

/** Floor for the derived reference resolution when the master is smaller than this. */
const MIN_BASE_PIXELS = 1080;

function roundToEven(n: number): number {
  return 2 * Math.round(n / 2);
}

/**
 * Target width/height for `aspect`, derived from the master's longest side (or
 * `MIN_BASE_PIXELS`, whichever is larger). Whichever axis is the aspect's longer ratio unit
 * (width for "16:9"/"1:1"; height for "9:16"/"4:5") is assigned that reference length; the other
 * side is computed proportionally and rounded to an even pixel count.
 */
export function reframeDimensions(
  masterSettings: { width: number; height: number },
  aspect: SocialAspect,
): { width: number; height: number } {
  const ratio = ASPECT_RATIO[aspect];
  const reference = roundToEven(
    Math.max(masterSettings.width, masterSettings.height, MIN_BASE_PIXELS),
  );
  if (ratio.w >= ratio.h) {
    return { width: reference, height: roundToEven((reference * ratio.h) / ratio.w) };
  }
  return { width: roundToEven((reference * ratio.w) / ratio.h), height: reference };
}

/** Portrait (taller than wide) counts as "tall"; landscape and square both count as not-tall,
 *  since squaring off a landscape frame is a crop, not a repositioning, in this heuristic. */
function isTall(width: number, height: number): boolean {
  return height > width;
}

/**
 * Structural descriptor only — no framing/vision analysis is performed. "keep" when the frame
 * already matches the target aspect ratio; "crop" when the tall/not-tall orientation is
 * unchanged (e.g. 16:9 -> 1:1, both not-tall); "reposition" when it flips (e.g. landscape source
 * to a vertical export), which a simple crop cannot fix.
 */
function intentFor(
  masterSettings: { width: number; height: number },
  target: { width: number; height: number },
): ReframeIntent {
  const masterRatio = masterSettings.width / masterSettings.height;
  const targetRatio = target.width / target.height;
  if (Math.abs(masterRatio - targetRatio) < 1e-9) return "keep";
  return isTall(masterSettings.width, masterSettings.height) === isTall(target.width, target.height)
    ? "crop"
    : "reposition";
}

export interface ReframeParams {
  id: string;
  /** ISO timestamp supplied by the caller so reframe() stays deterministic. */
  createdAt: string;
}

/**
 * Build a proposal sequence targeting social `aspect`, with one "reframe" Proposal per master
 * object. The master is copied structurally via `createProposalSequence` (never mutated); like
 * any other proposal, objects are NOT pre-populated into the candidate sequence — they only land
 * there once their Proposal is accepted (lifecycle.ts).
 */
export function reframe(
  master: Sequence,
  aspect: SocialAspect,
  params: ReframeParams,
): ProposalSequence {
  const dimensions = reframeDimensions(master.settings, aspect);
  const base = createProposalSequence(master, params);
  const intent = intentFor(master.settings, dimensions);

  const proposals: Proposal[] = master.objects.map((object: TimelineObject, index: number) => ({
    id: `${params.id}:reframe:${index}:${object.id}`,
    kind: "reframe",
    rationale: `Reframe "${object.id}" from ${master.settings.width}x${master.settings.height} to ${aspect} (${dimensions.width}x${dimensions.height}).`,
    confidence: 1,
    evidence: [
      `source-aspect:${master.settings.width}x${master.settings.height}`,
      `target-aspect:${aspect}`,
    ],
    source: {
      sequenceId: master.id,
      startTicks: object.startTicks,
      endTicks: sourceEndTicks(object.startTicks, object.durationTicks),
    },
    proposedObject: object,
    status: "pending",
    reframe: { aspect, intent },
  }));

  return {
    ...base,
    sequence: { ...base.sequence, settings: { ...base.sequence.settings, ...dimensions } },
    proposals,
  };
}
