import { describe, expect, it } from "vitest";
import {
  assistantCommandSchema,
  parseProposal,
  parseProposalSequence,
  parseScope,
  proposalSchema,
  proposalSequenceSchema,
  scopeSchema,
} from "./schemas";
import { createProposalSequence } from "./proposal-sequence";
import { clip, masterSequence } from "./test-fixtures";

describe("scopeSchema", () => {
  it("accepts a valid scope of each kind", () => {
    expect(scopeSchema.safeParse({ kind: "project", projectId: "prj_1" }).success).toBe(true);
    expect(scopeSchema.safeParse({ kind: "sequence", sequenceId: "seq_1" }).success).toBe(true);
    expect(
      scopeSchema.safeParse({ kind: "selection", sequenceId: "seq_1", objectIds: ["o1"] }).success,
    ).toBe(true);
    expect(
      scopeSchema.safeParse({ kind: "range", sequenceId: "seq_1", startTicks: 0, endTicks: 1000 })
        .success,
    ).toBe(true);
    expect(
      scopeSchema.safeParse({ kind: "period", sequenceId: "seq_1", periodId: "q3" }).success,
    ).toBe(true);
    expect(
      scopeSchema.safeParse({ kind: "team", sequenceId: "seq_1", teamId: "team_1" }).success,
    ).toBe(true);
    expect(
      scopeSchema.safeParse({ kind: "player", sequenceId: "seq_1", playerId: "player_23" }).success,
    ).toBe(true);
    expect(
      scopeSchema.safeParse({ kind: "event", sequenceId: "seq_1", eventId: "evt_1" }).success,
    ).toBe(true);
  });

  it("rejects an unknown scope kind", () => {
    expect(scopeSchema.safeParse({ kind: "sport", sequenceId: "seq_1" }).success).toBe(false);
  });

  it("rejects a range scope with endTicks <= startTicks", () => {
    const equal = scopeSchema.safeParse({
      kind: "range",
      sequenceId: "seq_1",
      startTicks: 1000,
      endTicks: 1000,
    });
    expect(equal.success).toBe(false);

    const reversed = scopeSchema.safeParse({
      kind: "range",
      sequenceId: "seq_1",
      startTicks: 1000,
      endTicks: 500,
    });
    expect(reversed.success).toBe(false);
  });

  it("rejects a selection scope with no object ids", () => {
    expect(
      scopeSchema.safeParse({ kind: "selection", sequenceId: "seq_1", objectIds: [] }).success,
    ).toBe(false);
  });

  it("rejects negative or non-integer ticks", () => {
    expect(
      scopeSchema.safeParse({ kind: "range", sequenceId: "seq_1", startTicks: -1, endTicks: 10 })
        .success,
    ).toBe(false);
    expect(
      scopeSchema.safeParse({ kind: "range", sequenceId: "seq_1", startTicks: 0, endTicks: 1.5 })
        .success,
    ).toBe(false);
  });

  it("parseScope validates and returns a typed Scope", () => {
    const scope = parseScope({ kind: "sequence", sequenceId: "seq_1" });
    expect(scope.kind).toBe("sequence");
  });

  it("parseScope throws on invalid input", () => {
    expect(() => parseScope({ kind: "sequence" })).toThrow();
  });
});

describe("assistantCommandSchema", () => {
  it("accepts a structured command with a scope and no NL content", () => {
    const result = assistantCommandSchema.safeParse({
      id: "cmd_1",
      intent: "find_highlights",
      scope: { kind: "team", sequenceId: "seq_1", teamId: "team_1" },
      createdAt: "2026-07-22T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("accepts opaque structured params", () => {
    const result = assistantCommandSchema.safeParse({
      id: "cmd_1",
      intent: "reframe",
      scope: { kind: "sequence", sequenceId: "seq_1" },
      params: { aspect: "9:16" },
      createdAt: "2026-07-22T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a command with an invalid nested scope", () => {
    const result = assistantCommandSchema.safeParse({
      id: "cmd_1",
      intent: "find_highlights",
      scope: { kind: "range", sequenceId: "seq_1", startTicks: 100, endTicks: 50 },
      createdAt: "2026-07-22T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("proposalSchema / parseProposal", () => {
  function validProposal() {
    return {
      id: "prop_1",
      kind: "highlight" as const,
      rationale: "Fast break with crowd reaction",
      confidence: 0.8,
      evidence: ["crowd-noise-peak"],
      source: { sequenceId: "seq_master", startTicks: 0, endTicks: 1000 },
      proposedObject: clip("clp_new", "trk_v1", 0, 1000),
      status: "pending" as const,
    };
  }

  it("accepts a valid proposal and round-trips through parseProposal", () => {
    const input = validProposal();
    expect(proposalSchema.safeParse(input).success).toBe(true);
    const parsed = parseProposal(input);
    expect(parsed.id).toBe("prop_1");
  });

  it("rejects confidence outside [0, 1]", () => {
    expect(proposalSchema.safeParse({ ...validProposal(), confidence: 1.1 }).success).toBe(false);
    expect(proposalSchema.safeParse({ ...validProposal(), confidence: -0.1 }).success).toBe(false);
  });

  it("rejects a malformed proposedObject (validated via timeline-domain's own object schema)", () => {
    const bad = { ...validProposal(), proposedObject: { kind: "clip" } };
    expect(proposalSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts an optional reframe descriptor", () => {
    const withReframe = {
      ...validProposal(),
      kind: "reframe",
      reframe: { aspect: "9:16", intent: "crop" },
    };
    expect(proposalSchema.safeParse(withReframe).success).toBe(true);
  });

  it("rejects an invalid reframe aspect", () => {
    const bad = {
      ...validProposal(),
      kind: "reframe",
      reframe: { aspect: "21:9", intent: "crop" },
    };
    expect(proposalSchema.safeParse(bad).success).toBe(false);
  });
});

describe("proposalSequenceSchema / parseProposalSequence", () => {
  it("round-trips a real ProposalSequence produced by createProposalSequence", () => {
    const master = masterSequence();
    const ps = createProposalSequence(master, {
      id: "prop_seq_1",
      createdAt: "2026-07-22T00:00:00Z",
    });
    const parsed = parseProposalSequence(JSON.parse(JSON.stringify(ps)));
    expect(parsed.id).toBe(ps.id);
    expect(parsed.masterSequenceId).toBe(master.id);
  });

  it("rejects a proposal sequence with an invalid nested sequence", () => {
    const bad = {
      id: "ps_1",
      masterSequenceId: "seq_1",
      sequence: {},
      proposals: [],
      createdAt: "x",
    };
    expect(proposalSequenceSchema.safeParse(bad).success).toBe(false);
  });
});
