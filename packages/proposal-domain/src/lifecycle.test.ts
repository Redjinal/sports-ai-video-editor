// CORE INVARIANT tests (release blocker): accepting/rejecting/modifying a proposal must never
// mutate the approved master sequence, its score, or its clock, and undo must work after
// acceptance.
import { describe, expect, it } from "vitest";
import { asTicks } from "@sve/timeline-domain";
import type { Proposal } from "./model";
import { createProposalSequence } from "./proposal-sequence";
import {
  accept,
  assertMasterUnchanged,
  modify,
  preview,
  ProposalLifecycleError,
  reject,
  undoAfterAccept,
} from "./lifecycle";
import { clip, masterSequence } from "./test-fixtures";

function highlightProposal(id: string, objectId: string): Proposal {
  return {
    id,
    kind: "highlight",
    rationale: "High-energy fast break with crowd reaction.",
    confidence: 0.82,
    evidence: ["crowd-noise-peak", "possession-change"],
    source: { sequenceId: "seq_master", startTicks: asTicks(0), endTicks: asTicks(900_000) },
    proposedObject: clip(objectId, "trk_v1", 0, 900_000),
    status: "pending",
  };
}

function seedProposalSequence() {
  const master = masterSequence();
  const base = createProposalSequence(master, {
    id: "prop_seq_1",
    createdAt: "2026-07-22T00:00:00Z",
  });
  const ps = { ...base, proposals: [highlightProposal("prop_1", "clp_new")] };
  return { master, ps };
}

describe("proposal lifecycle — master-mutation protection", () => {
  it("accept applies the change only to the proposal sequence; master is deep-equal unchanged", () => {
    const { master, ps } = seedProposalSequence();
    const masterSnapshot = JSON.parse(JSON.stringify(master));

    const { proposalSequence } = accept(ps, "prop_1");

    // Master is byte-for-byte unchanged.
    expect(master).toEqual(masterSnapshot);
    assertMasterUnchanged(masterSnapshot, master);

    // The change landed only in the (separate) proposal sequence.
    expect(proposalSequence.id).not.toBe(master.id);
    expect(proposalSequence.sequence.objects.map((o) => o.id)).toContain("clp_new");
    expect(master.objects.map((o) => o.id)).not.toContain("clp_new");
    expect(proposalSequence.proposals[0]!.status).toBe("accepted");
  });

  it("proposals are isolated in a separate sequence id from the master", () => {
    const { master, ps } = seedProposalSequence();
    expect(ps.id).not.toBe(master.id);
    expect(ps.sequence.id).not.toBe(master.id);
    expect(ps.masterSequenceId).toBe(master.id);
  });

  it("reject never touches the master and never adds the object to the proposal sequence", () => {
    const { master, ps } = seedProposalSequence();
    const masterSnapshot = JSON.parse(JSON.stringify(master));

    const { proposalSequence } = reject(ps, "prop_1");

    expect(master).toEqual(masterSnapshot);
    expect(proposalSequence.proposals[0]!.status).toBe("rejected");
    expect(proposalSequence.sequence.objects.map((o) => o.id)).not.toContain("clp_new");
    // Reject didn't touch the proposal sequence's objects at all.
    expect(proposalSequence.sequence.objects).toEqual(ps.sequence.objects);
  });

  it("modify never touches the master and only updates the proposal record", () => {
    const { master, ps } = seedProposalSequence();
    const masterSnapshot = JSON.parse(JSON.stringify(master));

    const { proposalSequence } = modify(ps, "prop_1", {
      confidence: 0.55,
      rationale: "Edited by user",
    });

    expect(master).toEqual(masterSnapshot);
    expect(proposalSequence.proposals[0]!.status).toBe("modified");
    expect(proposalSequence.proposals[0]!.confidence).toBe(0.55);
    expect(proposalSequence.proposals[0]!.rationale).toBe("Edited by user");
    // Object catalog is untouched until an explicit accept.
    expect(proposalSequence.sequence.objects).toEqual(ps.sequence.objects);
  });

  it("undo-after-accept restores the exact prior proposal sequence", () => {
    const { ps } = seedProposalSequence();
    const { proposalSequence: accepted, inverse } = accept(ps, "prop_1");

    expect(accepted).not.toEqual(ps); // something changed
    const restored = undoAfterAccept({ proposalSequence: accepted, inverse });
    expect(restored).toEqual(ps);
    expect(restored).toBe(ps); // inverse is the untouched original reference
  });

  it("preview shows the candidate merge without persisting or mutating the proposal sequence", () => {
    const { ps } = seedProposalSequence();
    const previewed = preview(ps, "prop_1");
    expect(previewed.objects.map((o) => o.id)).toContain("clp_new");
    // The proposal sequence itself is untouched.
    expect(ps.sequence.objects.map((o) => o.id)).not.toContain("clp_new");
    expect(ps.proposals[0]!.status).toBe("pending");
  });

  it("accept is idempotent on an already-present object (reframe-style upsert)", () => {
    const master = masterSequence();
    const base = createProposalSequence(master, {
      id: "prop_seq_1",
      createdAt: "2026-07-22T00:00:00Z",
    });
    const existing = clip("clp_1", "trk_v1", 0, 900_000);
    const ps = {
      ...base,
      sequence: { ...base.sequence, objects: [existing] },
      proposals: [
        {
          id: "prop_reframe",
          kind: "reframe" as const,
          rationale: "keep",
          confidence: 1,
          evidence: [],
          source: { sequenceId: master.id, startTicks: asTicks(0), endTicks: asTicks(900_000) },
          proposedObject: existing,
          status: "pending" as const,
        },
      ],
    };
    const { proposalSequence } = accept(ps, "prop_reframe");
    expect(proposalSequence.sequence.objects).toHaveLength(1);
    expect(proposalSequence.sequence.objects[0]!.id).toBe("clp_1");
  });

  it("throws a typed error for an unknown proposal id and leaves everything untouched", () => {
    const { master, ps } = seedProposalSequence();
    const masterSnapshot = JSON.parse(JSON.stringify(master));
    expect(() => accept(ps, "does-not-exist")).toThrow(ProposalLifecycleError);
    expect(master).toEqual(masterSnapshot);
  });

  it("assertMasterUnchanged throws when the master actually differs", () => {
    const master = masterSequence();
    const mutated = { ...master, name: "Renamed" };
    expect(() => assertMasterUnchanged(master, mutated)).toThrow();
  });
});
