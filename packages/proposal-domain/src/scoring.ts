// Provider-neutral highlight scoring surface + pure ranking/filtering/display helpers.
//
// THE AI PROVIDER IS UNRESOLVED: `HighlightScorer` is an interface only — no implementation, and
// no concrete AI/LLM/vision provider is referenced anywhere in this file or package. NL parsing
// and highlight detection themselves are provider work; this module models only the shape a
// scorer's output takes and pure math over already-produced Proposals.
import type { Ticks } from "@sve/timeline-domain";
import type { Proposal } from "./model";

/**
 * One span a scorer is asked to judge. `context` is an opaque hint bag (team/player/event ids,
 * transcript excerpts, detected-event labels, etc.) — interpreting it is provider work and is
 * not modeled here.
 */
export interface ScoringCandidate {
  sequenceId: string;
  startTicks: Ticks;
  endTicks: Ticks;
  context?: Record<string, unknown>;
}

/**
 * Provider-neutral contract for turning candidate spans into scored Proposals. No implementation
 * ships in this package — the concrete AI/vision provider is an unresolved product decision, and
 * selecting one is explicitly out of scope here.
 */
export interface HighlightScorer {
  score(candidates: ScoringCandidate[]): Promise<Proposal[]> | Proposal[];
}

/** Sort proposals by confidence, descending (highest first). Pure — never mutates the input. */
export function rankProposals(proposals: readonly Proposal[]): Proposal[] {
  return [...proposals].sort((a, b) => b.confidence - a.confidence);
}

/** Curried predicate factory: keep only proposals at or above `threshold` confidence. */
export function filterByConfidence(
  threshold: number,
): (proposals: readonly Proposal[]) => Proposal[] {
  return (proposals: readonly Proposal[]) => proposals.filter((p) => p.confidence >= threshold);
}

export type ConfidenceLabel = "low" | "medium" | "high";

/** Display model for a proposal's evidence/confidence, for the review UI. */
export interface EvidenceSummary {
  proposalId: string;
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  evidenceCount: number;
  evidence: string[];
  rationale: string;
}

const HIGH_CONFIDENCE = 0.75;
const MEDIUM_CONFIDENCE = 0.4;

/** Build the evidence/confidence display model for a single proposal. */
export function evidenceSummary(proposal: Proposal): EvidenceSummary {
  const confidenceLabel: ConfidenceLabel =
    proposal.confidence >= HIGH_CONFIDENCE
      ? "high"
      : proposal.confidence >= MEDIUM_CONFIDENCE
        ? "medium"
        : "low";
  return {
    proposalId: proposal.id,
    confidence: proposal.confidence,
    confidenceLabel,
    evidenceCount: proposal.evidence.length,
    evidence: proposal.evidence,
    rationale: proposal.rationale,
  };
}
