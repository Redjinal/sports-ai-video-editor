// Scoreboard input boundary (M9 broadcast graphics & replays).
//
// DECOUPLING BOUNDARY: this package intentionally defines its OWN plain scoreboard
// input shape instead of importing `@sve/basketball-domain` (built in parallel and not
// available here). `ScoreboardState` is the seam a later adapter maps basketball-domain
// game state onto — this package never assumes anything about how a score/clock is
// produced, only that it can be handed a value matching this shape.
import { z } from "zod";

export const possessionSchema = z.enum(["home", "away", "none"]);
export type Possession = z.infer<typeof possessionSchema>;

export const teamStateSchema = z.object({
  name: z.string().min(1),
  abbreviation: z.string().min(1),
  /** Reference to a project asset (team logo); resolved by the rendering adapter. */
  logoAssetId: z.string().min(1).optional(),
  primaryColor: z.string().min(1),
  secondaryColor: z.string().min(1),
  score: z.number().int().nonnegative(),
  fouls: z.number().int().nonnegative(),
  timeoutsRemaining: z.number().int().nonnegative(),
  inBonus: z.boolean(),
});
export type TeamState = z.infer<typeof teamStateSchema>;

export const scoreboardStateSchema = z.object({
  home: teamStateSchema,
  away: teamStateSchema,
  /** 1-based period index; 1-4 are regulation quarters, 5+ are overtime periods. */
  period: z.number().int().positive(),
  /** Time remaining in the current period, in milliseconds (display-only unit). */
  gameClockMs: z.number().nonnegative(),
  possession: possessionSchema,
  /** Time remaining on the shot clock, in milliseconds. Absent when not applicable. */
  shotClockMs: z.number().nonnegative().optional(),
});
export type ScoreboardState = z.infer<typeof scoreboardStateSchema>;

/** Validate an untrusted scoreboard payload (e.g. from an adapter) at the boundary. */
export function parseScoreboardState(input: unknown): ScoreboardState {
  return scoreboardStateSchema.parse(input);
}
