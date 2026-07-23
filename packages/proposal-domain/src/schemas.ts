// Zod schemas mirroring model.ts, for boundary validation of untrusted input (e.g. a future NL
// layer's structured output, or a proposal set read back from disk). Runtime shapes only; the
// hand-authored types in model.ts stay authoritative for branded Ticks.
import { z } from "zod";
import { sequenceSchema } from "@sve/timeline-domain";
import type { AssistantCommand, Proposal, ProposalSequence, Scope } from "./model";

const tickSchema = z.number().int().nonnegative();

// Reuse timeline-domain's own object validation (the element schema of its `objects` array)
// instead of duplicating SourceClip/NestedSequenceObject rules here, so the two packages can
// never drift out of sync.
const timelineObjectSchema = sequenceSchema.shape.objects.element;

const rangeScopeSchema = z.object({
  kind: z.literal("range"),
  sequenceId: z.string().min(1),
  startTicks: tickSchema,
  endTicks: tickSchema,
});

export const scopeSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("project"), projectId: z.string().min(1) }),
    z.object({ kind: z.literal("sequence"), sequenceId: z.string().min(1) }),
    z.object({
      kind: z.literal("selection"),
      sequenceId: z.string().min(1),
      objectIds: z.array(z.string().min(1)).min(1),
    }),
    rangeScopeSchema,
    z.object({
      kind: z.literal("period"),
      sequenceId: z.string().min(1),
      periodId: z.string().min(1),
    }),
    z.object({ kind: z.literal("team"), sequenceId: z.string().min(1), teamId: z.string().min(1) }),
    z.object({
      kind: z.literal("player"),
      sequenceId: z.string().min(1),
      playerId: z.string().min(1),
    }),
    z.object({
      kind: z.literal("event"),
      sequenceId: z.string().min(1),
      eventId: z.string().min(1),
    }),
  ])
  .superRefine((value, ctx) => {
    if (value.kind === "range" && value.endTicks <= value.startTicks) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "range scope requires endTicks > startTicks",
        path: ["endTicks"],
      });
    }
  });

export const assistantCommandSchema = z.object({
  id: z.string().min(1),
  intent: z.string().min(1),
  scope: scopeSchema,
  params: z.record(z.unknown()).optional(),
  createdAt: z.string(),
});

const socialAspectSchema = z.enum(["16:9", "9:16", "1:1", "4:5"]);
const reframeIntentSchema = z.enum(["keep", "crop", "reposition"]);

export const proposalSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["highlight", "trim", "caption", "reframe", "custom"]),
  rationale: z.string(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()),
  source: z.object({
    sequenceId: z.string().min(1),
    startTicks: tickSchema,
    endTicks: tickSchema,
  }),
  proposedObject: timelineObjectSchema,
  status: z.enum(["pending", "accepted", "rejected", "modified"]),
  reframe: z.object({ aspect: socialAspectSchema, intent: reframeIntentSchema }).optional(),
});

export const proposalSequenceSchema = z.object({
  id: z.string().min(1),
  masterSequenceId: z.string().min(1),
  sequence: sequenceSchema,
  proposals: z.array(proposalSchema),
  createdAt: z.string(),
});

/** Validate an untrusted Scope payload into a typed Scope (boundary validation). */
export function parseScope(input: unknown): Scope {
  return scopeSchema.parse(input) as unknown as Scope;
}

/** Validate an untrusted AssistantCommand payload into a typed AssistantCommand. */
export function parseAssistantCommand(input: unknown): AssistantCommand {
  return assistantCommandSchema.parse(input) as unknown as AssistantCommand;
}

/** Validate an untrusted Proposal payload into a typed Proposal. */
export function parseProposal(input: unknown): Proposal {
  return proposalSchema.parse(input) as unknown as Proposal;
}

/** Validate an untrusted ProposalSequence payload into a typed ProposalSequence. */
export function parseProposalSequence(input: unknown): ProposalSequence {
  return proposalSequenceSchema.parse(input) as unknown as ProposalSequence;
}
