import { describe, expect, it } from "vitest";
import { asTicks } from "@sve/timeline-domain";
import type { Proposal } from "./model";
import { evidenceSummary, filterByConfidence, rankProposals } from "./scoring";
import { clip } from "./test-fixtures";

function proposal(id: string, confidence: number, evidence: string[] = []): Proposal {
  return {
    id,
    kind: "highlight",
    rationale: `rationale for ${id}`,
    confidence,
    evidence,
    source: { sequenceId: "seq_master", startTicks: asTicks(0), endTicks: asTicks(1000) },
    proposedObject: clip(id, "trk_v1", 0, 1000),
    status: "pending",
  };
}

describe("rankProposals", () => {
  it("sorts by confidence descending", () => {
    const proposals = [proposal("a", 0.3), proposal("b", 0.9), proposal("c", 0.6)];
    expect(rankProposals(proposals).map((p) => p.id)).toEqual(["b", "c", "a"]);
  });

  it("does not mutate the input array", () => {
    const proposals = [proposal("a", 0.3), proposal("b", 0.9)];
    const snapshot = [...proposals];
    rankProposals(proposals);
    expect(proposals).toEqual(snapshot);
  });
});

describe("filterByConfidence", () => {
  it("keeps only proposals at or above the threshold", () => {
    const proposals = [proposal("a", 0.3), proposal("b", 0.9), proposal("c", 0.6)];
    const atLeast60 = filterByConfidence(0.6)(proposals);
    expect(atLeast60.map((p) => p.id).sort()).toEqual(["b", "c"]);
  });

  it("is inclusive of the exact threshold value", () => {
    const proposals = [proposal("a", 0.5)];
    expect(filterByConfidence(0.5)(proposals)).toHaveLength(1);
  });
});

describe("evidenceSummary", () => {
  it("labels confidence bands correctly", () => {
    expect(evidenceSummary(proposal("a", 0.9)).confidenceLabel).toBe("high");
    expect(evidenceSummary(proposal("b", 0.5)).confidenceLabel).toBe("medium");
    expect(evidenceSummary(proposal("c", 0.1)).confidenceLabel).toBe("low");
  });

  it("carries through evidence, count, and rationale for display", () => {
    const p = proposal("a", 0.8, ["crowd-noise-peak", "possession-change"]);
    const summary = evidenceSummary(p);
    expect(summary.proposalId).toBe("a");
    expect(summary.evidence).toEqual(["crowd-noise-peak", "possession-change"]);
    expect(summary.evidenceCount).toBe(2);
    expect(summary.rationale).toBe("rationale for a");
  });
});
