// Game setup: teams and rules (M8 basketball domain).
// Pure data + zod validation; no I/O. Game-clock durations are expressed in
// milliseconds (a real-world basketball clock), distinct from authoritative
// timeline ticks — see clock.ts for how the two are related via anchors.
import { z } from "zod";

export const teamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  abbreviation: z.string().min(1).max(6),
  /** Optional asset id for the team's logo; resolved by the asset registry, not here. */
  logoAssetId: z.string().min(1).optional(),
  primaryColor: z.string().min(1),
  secondaryColor: z.string().min(1),
});
export type Team = z.infer<typeof teamSchema>;

export const gameRulesSchema = z.object({
  periodCount: z.number().int().positive(),
  periodLengthMs: z.number().int().positive(),
  /** Team fouls in a period at/after which the fouled-against team shoots bonus free throws. */
  foulsToBonus: z.number().int().positive(),
  timeoutsPerTeam: z.number().int().nonnegative(),
  overtimeLengthMs: z.number().int().positive(),
  /** Omitted when the ruleset (e.g. rec league) has no shot clock. */
  shotClockMs: z.number().int().positive().optional(),
});
export type GameRules = z.infer<typeof gameRulesSchema>;

export const gameSetupSchema = z.object({
  home: teamSchema,
  away: teamSchema,
  rules: gameRulesSchema,
});
export type GameSetup = z.infer<typeof gameSetupSchema>;

/** Validate an untrusted team payload (e.g. read from disk) into a typed Team. */
export function parseTeam(input: unknown): Team {
  return teamSchema.parse(input);
}

/** Validate an untrusted rules payload into typed GameRules. */
export function parseGameRules(input: unknown): GameRules {
  return gameRulesSchema.parse(input);
}

/** Validate an untrusted game setup payload into a typed GameSetup. */
export function parseGameSetup(input: unknown): GameSetup {
  return gameSetupSchema.parse(input);
}
