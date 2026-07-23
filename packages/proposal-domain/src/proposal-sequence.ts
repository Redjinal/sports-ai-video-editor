// Proposal-sequence creation: copy a master's structural skeleton into a fresh, separate
// candidate sequence — never mutating the master (M10 master-mutation protection, release
// blocker).
import type { Sequence } from "@sve/timeline-domain";
import type { ProposalSequence } from "./model";

export interface CreateProposalSequenceParams {
  id: string;
  /** ISO timestamp supplied by the caller so creation stays deterministic. */
  createdAt: string;
}

/**
 * Copy `master`'s structure (settings, tracks, markers) into a new sequence with its own id.
 * Objects start empty: like any other proposal, a timeline object only lands in the candidate
 * sequence once its Proposal is accepted (see lifecycle.ts's `accept`). `master` is only read —
 * every nested array/object on the result is freshly spread, so nothing here can share a
 * mutable path back into it.
 */
export function createProposalSequence(
  master: Sequence,
  params: CreateProposalSequenceParams,
): ProposalSequence {
  const sequence: Sequence = {
    ...master,
    id: params.id,
    tracks: master.tracks.map((t) => ({ ...t })),
    objects: [],
    markers: master.markers.map((m) => ({ ...m })),
    parentSequenceIds: [...master.parentSequenceIds],
  };
  return {
    id: params.id,
    masterSequenceId: master.id,
    sequence,
    proposals: [],
    createdAt: params.createdAt,
  };
}
