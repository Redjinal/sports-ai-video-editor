// Proposal lifecycle: preview / accept / reject / modify — pure functions over a
// ProposalSequence.
//
// CORE INVARIANT (master-mutation protection, release blocker): none of these functions take a
// master Sequence as input at all — they only ever read/replace a ProposalSequence's own
// `sequence.objects` and `proposals`, always via immutable spread, never in place. So there is no
// code path here through which accepting, rejecting, or modifying a proposal could reach the
// master sequence, its score, or its clock. `assertMasterUnchanged` below is the proof used in
// tests: snapshot the master before running lifecycle operations, and assert it is unchanged
// after.
import type { Sequence, TimelineObject } from "@sve/timeline-domain";
import type { Proposal, ProposalSequence } from "./model";

export class ProposalLifecycleError extends Error {
  constructor(
    message: string,
    readonly code: "PROPOSAL_NOT_FOUND",
  ) {
    super(message);
    this.name = "ProposalLifecycleError";
  }
}

function requireProposal(ps: ProposalSequence, proposalId: string): Proposal {
  const proposal = ps.proposals.find((p) => p.id === proposalId);
  if (!proposal) {
    throw new ProposalLifecycleError(`Proposal ${proposalId} not found`, "PROPOSAL_NOT_FOUND");
  }
  return proposal;
}

/** Upsert `object` into `objects` by id. Pure — returns a new array, never mutates `objects`. */
function withObject(objects: TimelineObject[], object: TimelineObject): TimelineObject[] {
  const exists = objects.some((o) => o.id === object.id);
  return exists ? objects.map((o) => (o.id === object.id ? object : o)) : [...objects, object];
}

export interface LifecycleResult {
  proposalSequence: ProposalSequence;
  /**
   * The ProposalSequence exactly as it was immediately before this operation. Nothing above is
   * ever mutated in place, so this is simply the value passed in — pass it to `undoAfterAccept`
   * (or use it directly) to revert accept/reject/modify, including undo-after-acceptance.
   */
  inverse: ProposalSequence;
}

/**
 * Non-committing preview: what the candidate sequence would look like with this proposal's
 * object applied. Returns a new Sequence value for rendering; does not change the
 * ProposalSequence (its `proposals` and `sequence.objects` are untouched).
 */
export function preview(ps: ProposalSequence, proposalId: string): Sequence {
  const proposal = requireProposal(ps, proposalId);
  return { ...ps.sequence, objects: withObject(ps.sequence.objects, proposal.proposedObject) };
}

/**
 * Accept a proposal: applies its `proposedObject` to THIS proposal sequence's own `sequence`
 * only, and marks the proposal accepted. There is no master sequence reference anywhere in this
 * function's inputs or outputs — accepting can never mutate a master, its score, or its clock.
 */
export function accept(ps: ProposalSequence, proposalId: string): LifecycleResult {
  const proposal = requireProposal(ps, proposalId);
  const objects = withObject(ps.sequence.objects, proposal.proposedObject);
  const proposals = ps.proposals.map((p) =>
    p.id === proposalId ? { ...p, status: "accepted" as const } : p,
  );
  const proposalSequence: ProposalSequence = {
    ...ps,
    sequence: { ...ps.sequence, objects },
    proposals,
  };
  return { proposalSequence, inverse: ps };
}

/**
 * Reject a proposal: marks it rejected. Never adds its object to the proposal sequence, and
 * (like every function here) never touches a master sequence.
 */
export function reject(ps: ProposalSequence, proposalId: string): LifecycleResult {
  requireProposal(ps, proposalId);
  const proposals = ps.proposals.map((p) =>
    p.id === proposalId ? { ...p, status: "rejected" as const } : p,
  );
  return { proposalSequence: { ...ps, proposals }, inverse: ps };
}

export interface ProposalModification {
  proposedObject?: TimelineObject;
  rationale?: string;
  confidence?: number;
  evidence?: string[];
}

/**
 * Modify a pending proposal's content (e.g. the user drags the suggested in/out points) before
 * deciding. Only updates the proposal record in `proposals`; `sequence.objects` is untouched
 * until a later `accept`. Never touches a master sequence.
 */
export function modify(
  ps: ProposalSequence,
  proposalId: string,
  changes: ProposalModification,
): LifecycleResult {
  const existing = requireProposal(ps, proposalId);
  const updated: Proposal = { ...existing, ...changes, status: "modified" };
  const proposals = ps.proposals.map((p) => (p.id === proposalId ? updated : p));
  return { proposalSequence: { ...ps, proposals }, inverse: ps };
}

/**
 * Undo the most recent accept/reject/modify by returning the pre-operation snapshot. Works after
 * acceptance because `accept` never mutates its input `ps` — `inverse` is that exact prior value.
 */
export function undoAfterAccept(result: LifecycleResult): ProposalSequence {
  return result.inverse;
}

/**
 * Structural deep-equality over plain JSON-safe domain data. Ticks branding is a TS-only
 * construct erased at runtime, so a structural comparison is exactly a byte-for-byte comparison
 * here.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (a !== null && b !== null && typeof a === "object" && typeof b === "object") {
    const aRec = a as Record<string, unknown>;
    const bRec = b as Record<string, unknown>;
    const aKeys = Object.keys(aRec);
    const bKeys = Object.keys(bRec);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(
      (k) => Object.prototype.hasOwnProperty.call(bRec, k) && deepEqual(aRec[k], bRec[k]),
    );
  }
  return false;
}

/**
 * Master-mutation-protection guard (release blocker): assert a master sequence is
 * byte-for-byte unchanged across some operation. Intended for tests to wrap every
 * accept/reject/modify call — none of them should ever be able to make this throw, since none
 * of them accept a master Sequence as input in the first place.
 */
export function assertMasterUnchanged(before: Sequence, after: Sequence): void {
  if (!deepEqual(before, after)) {
    throw new Error("Master sequence was mutated — this is a release-blocking invariant violation");
  }
}
