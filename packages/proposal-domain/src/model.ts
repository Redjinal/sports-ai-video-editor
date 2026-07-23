// Structured assistant-command, proposal, and social-sequence model (M10 AI proposals &
// social sequences). Hand-authored types; schemas.ts mirrors these 1:1 for boundary validation
// (mirrors timeline-domain's model.ts / serialization.ts split).
//
// THE AI PROVIDER IS UNRESOLVED: nothing in this package selects, calls, or wraps a concrete
// AI/LLM/vision provider. `AssistantCommand` is the structured target an NL layer (out of scope
// here) would resolve a request down to; `HighlightScorer` (scoring.ts) is a provider-neutral
// interface with no implementation. This module models structure, scoring math, and lifecycle
// only — never a model call.
import type { Sequence, TimelineObject, Ticks } from "@sve/timeline-domain";

/**
 * The structured target of an assistant command: what an NL layer would resolve a request
 * ("cut a highlight reel of the third quarter") down to, before any provider call. Every branch
 * carries exactly the ids/range it needs to be actionable without further interpretation.
 */
export type Scope =
  | { kind: "project"; projectId: string }
  | { kind: "sequence"; sequenceId: string }
  | { kind: "selection"; sequenceId: string; objectIds: string[] }
  | { kind: "range"; sequenceId: string; startTicks: Ticks; endTicks: Ticks }
  | { kind: "period"; sequenceId: string; periodId: string }
  | { kind: "team"; sequenceId: string; teamId: string }
  | { kind: "player"; sequenceId: string; playerId: string }
  | { kind: "event"; sequenceId: string; eventId: string };

/**
 * A structured command an NL layer hands to this domain: an intent label plus the Scope it
 * targets. `intent` and `params` are opaque payloads defined by whatever NL/provider layer
 * produced them — this package never parses natural language or interprets them, only carries
 * and validates their shape.
 */
export interface AssistantCommand {
  id: string;
  /** Provider/NL-layer-defined intent label (e.g. "find_highlights", "reframe"); opaque here. */
  intent: string;
  scope: Scope;
  /** Structured parameters the NL layer already extracted; opaque payload, not interpreted here. */
  params?: Record<string, unknown>;
  /** ISO timestamp supplied by the caller so command construction stays deterministic. */
  createdAt: string;
}

export type ProposalKind = "highlight" | "trim" | "caption" | "reframe" | "custom";
export type ProposalStatus = "pending" | "accepted" | "rejected" | "modified";

/** Social export aspect ratios (M10 social sequences). */
export type SocialAspect = "16:9" | "9:16" | "1:1" | "4:5";

/**
 * How a reframe would treat one object — a descriptor only. No visual crop/pan/scale transform
 * is computed or applied anywhere in this package (the timeline model has no per-object framing
 * fields on this branch, and that module isn't part of this package).
 */
export type ReframeIntent = "keep" | "crop" | "reposition";

/**
 * A proposed change, always traceable back to the master content it was derived from via
 * `source`. AI *proposes*: a Proposal record never touches the master sequence merely by
 * existing — only `accept()` (lifecycle.ts) materializes its `proposedObject`, and only into a
 * separate ProposalSequence (see model.ts's ProposalSequence and the master-mutation-protection
 * guard `assertMasterUnchanged` in lifecycle.ts).
 */
export interface Proposal {
  id: string;
  kind: ProposalKind;
  /** Human-readable justification, shown in the review UI. */
  rationale: string;
  /** Model/heuristic confidence in [0, 1]. */
  confidence: number;
  /** Supporting evidence strings (e.g. transcript snippets, detected event labels). */
  evidence: string[];
  /** Where in the master this proposal was derived from, for traceability. */
  source: { sequenceId: string; startTicks: Ticks; endTicks: Ticks };
  /** The timeline object this proposal would place into the proposal sequence once accepted. */
  proposedObject: TimelineObject;
  status: ProposalStatus;
  /** Present only for kind "reframe": the target aspect and this object's framing descriptor. */
  reframe?: { aspect: SocialAspect; intent: ReframeIntent };
}

/**
 * A SEPARATE candidate sequence an assistant proposal lives in. Distinct `id` from the master;
 * `masterSequenceId` records lineage only — it is never used to reach back into and mutate the
 * master. Accepting/rejecting/modifying a proposal (lifecycle.ts) mutates only this value's own
 * `sequence`/`proposals`, never the master sequence, its score, or its clock.
 */
export interface ProposalSequence {
  id: string;
  masterSequenceId: string;
  sequence: Sequence;
  proposals: Proposal[];
  createdAt: string;
}
