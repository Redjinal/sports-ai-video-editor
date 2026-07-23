// Event-sourced game log (M8 basketball domain).
// The log is the single source of truth: score, fouls, timeouts, and on-court players are
// never stored directly — they are always derived from this ordered event list (derive.ts).
// That is what makes corrections (corrections.ts) work: editing/removing/appending an event
// and re-deriving always yields an internally-consistent result.
import { z } from "zod";
import type { Ticks } from "@sve/timeline-domain";

export type FoulKind = "personal" | "technical" | "flagrant";
export type ScorePoints = 1 | 2 | 3;

interface GameEventBase {
  id: string;
  /** Position on the editing timeline this event corresponds to. */
  atTicks: Ticks;
  /** Game-clock reading (ms remaining in the period) at the moment of this event. */
  gameClockMs: number;
}

export interface ScoreEvent extends GameEventBase {
  type: "score";
  teamId: string;
  playerId: string;
  points: ScorePoints;
}

export interface FoulEvent extends GameEventBase {
  type: "foul";
  teamId: string;
  playerId: string;
  kind: FoulKind;
}

export interface TimeoutEvent extends GameEventBase {
  type: "timeout";
  teamId: string;
}

export interface SubstitutionEvent extends GameEventBase {
  type: "substitution";
  teamId: string;
  playerInId: string;
  playerOutId: string;
}

export interface PeriodStartEvent extends GameEventBase {
  type: "periodStart";
  period: number;
}

export interface PeriodEndEvent extends GameEventBase {
  type: "periodEnd";
  period: number;
}

export interface CustomEvent extends GameEventBase {
  type: "custom";
  label: string;
  teamId?: string;
  playerId?: string;
}

/**
 * Non-destructive score correction. Rather than silently rewriting a `score` event's history,
 * a correction is appended as its own event carrying a signed point delta, so the log keeps a
 * full audit trail of "what actually happened" (see corrections.ts `correctScore`).
 */
export interface AdjustmentEvent extends GameEventBase {
  type: "adjustment";
  teamId: string;
  /** Signed point delta applied on top of the derived score for this team. */
  points: number;
  reason: string;
}

export type GameEvent =
  | ScoreEvent
  | FoulEvent
  | TimeoutEvent
  | SubstitutionEvent
  | PeriodStartEvent
  | PeriodEndEvent
  | CustomEvent
  | AdjustmentEvent;

export type GameEventType = GameEvent["type"];

/** The ordered event log. Array order is the authoritative chronological order. */
export type GameLog = readonly GameEvent[];

const baseFields = {
  id: z.string().min(1),
  atTicks: z.number().int().nonnegative(),
  gameClockMs: z.number().int().nonnegative(),
};

const scoreEventSchema = z.object({
  ...baseFields,
  type: z.literal("score"),
  teamId: z.string().min(1),
  playerId: z.string().min(1),
  points: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

const foulEventSchema = z.object({
  ...baseFields,
  type: z.literal("foul"),
  teamId: z.string().min(1),
  playerId: z.string().min(1),
  kind: z.enum(["personal", "technical", "flagrant"]),
});

const timeoutEventSchema = z.object({
  ...baseFields,
  type: z.literal("timeout"),
  teamId: z.string().min(1),
});

const substitutionEventSchema = z.object({
  ...baseFields,
  type: z.literal("substitution"),
  teamId: z.string().min(1),
  playerInId: z.string().min(1),
  playerOutId: z.string().min(1),
});

const periodStartEventSchema = z.object({
  ...baseFields,
  type: z.literal("periodStart"),
  period: z.number().int().positive(),
});

const periodEndEventSchema = z.object({
  ...baseFields,
  type: z.literal("periodEnd"),
  period: z.number().int().positive(),
});

const customEventSchema = z.object({
  ...baseFields,
  type: z.literal("custom"),
  label: z.string().min(1),
  teamId: z.string().min(1).optional(),
  playerId: z.string().min(1).optional(),
});

const adjustmentEventSchema = z.object({
  ...baseFields,
  type: z.literal("adjustment"),
  teamId: z.string().min(1),
  points: z.number().int(),
  reason: z.string().min(1),
});

export const gameEventSchema = z.discriminatedUnion("type", [
  scoreEventSchema,
  foulEventSchema,
  timeoutEventSchema,
  substitutionEventSchema,
  periodStartEventSchema,
  periodEndEventSchema,
  customEventSchema,
  adjustmentEventSchema,
]);

/** Validate an untrusted event payload (e.g. read from disk); reapplies the Ticks brand. */
export function parseGameEvent(input: unknown): GameEvent {
  return gameEventSchema.parse(input) as unknown as GameEvent;
}

/** Validate an untrusted event-log payload into a typed, ordered GameLog. */
export function parseGameLog(input: unknown): GameEvent[] {
  return z.array(gameEventSchema).parse(input) as unknown as GameEvent[];
}
