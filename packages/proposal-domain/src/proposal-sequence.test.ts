import { describe, expect, it } from "vitest";
import { createProposalSequence } from "./proposal-sequence";
import { masterSequence } from "./test-fixtures";

describe("createProposalSequence", () => {
  it("gets its own id, distinct from the master", () => {
    const master = masterSequence();
    const ps = createProposalSequence(master, {
      id: "prop_seq_1",
      createdAt: "2026-07-22T00:00:00Z",
    });
    expect(ps.id).toBe("prop_seq_1");
    expect(ps.id).not.toBe(master.id);
    expect(ps.sequence.id).toBe("prop_seq_1");
  });

  it("records lineage back to the master via masterSequenceId", () => {
    const master = masterSequence();
    const ps = createProposalSequence(master, {
      id: "prop_seq_1",
      createdAt: "2026-07-22T00:00:00Z",
    });
    expect(ps.masterSequenceId).toBe(master.id);
  });

  it("copies structure (settings/tracks/markers) but starts with no objects", () => {
    const master = masterSequence();
    const ps = createProposalSequence(master, {
      id: "prop_seq_1",
      createdAt: "2026-07-22T00:00:00Z",
    });
    expect(ps.sequence.settings).toEqual(master.settings);
    expect(ps.sequence.tracks).toEqual(master.tracks);
    expect(ps.sequence.markers).toEqual(master.markers);
    expect(ps.sequence.objects).toEqual([]);
    expect(ps.proposals).toEqual([]);
  });

  it("never mutates the master sequence", () => {
    const master = masterSequence();
    const before = JSON.parse(JSON.stringify(master));
    createProposalSequence(master, { id: "prop_seq_1", createdAt: "2026-07-22T00:00:00Z" });
    expect(master).toEqual(before);
  });

  it("does not share mutable array references with the master", () => {
    const master = masterSequence();
    const ps = createProposalSequence(master, {
      id: "prop_seq_1",
      createdAt: "2026-07-22T00:00:00Z",
    });
    expect(ps.sequence.tracks).not.toBe(master.tracks);
    expect(ps.sequence.markers).not.toBe(master.markers);
    // Mutating the copy's nested arrays must never reach the master.
    ps.sequence.tracks[0]!.name = "mutated";
    expect(master.tracks[0]!.name).not.toBe("mutated");
  });
});
