// Player lower-third: a name strap graphic naming/highlighting a single player.
import { z } from "zod";

export const teamColorsSchema = z.object({
  primaryColor: z.string().min(1),
  secondaryColor: z.string().min(1),
});
export type TeamColors = z.infer<typeof teamColorsSchema>;

export const playerStatLineSchema = z.object({
  points: z.number().int().nonnegative().optional(),
  rebounds: z.number().int().nonnegative().optional(),
  assists: z.number().int().nonnegative().optional(),
});
export type PlayerStatLine = z.infer<typeof playerStatLineSchema>;

export interface PlayerLowerThirdInput {
  name: string;
  number: number;
  teamColors: TeamColors;
  statLine?: PlayerStatLine;
}

export interface PlayerLowerThirdViewModel {
  displayName: string;
  number: number;
  primaryColor: string;
  secondaryColor: string;
  /** e.g. "18 PTS · 7 REB · 5 AST"; absent when no stat line was supplied. */
  statLineLabel?: string;
}

function formatStatLine(statLine: PlayerStatLine): string | undefined {
  const parts: string[] = [];
  if (statLine.points !== undefined) parts.push(`${statLine.points} PTS`);
  if (statLine.rebounds !== undefined) parts.push(`${statLine.rebounds} REB`);
  if (statLine.assists !== undefined) parts.push(`${statLine.assists} AST`);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/** Build a display-ready view-model for a player name-strap lower third. */
export function buildPlayerLowerThird(input: PlayerLowerThirdInput): PlayerLowerThirdViewModel {
  const statLineLabel = input.statLine !== undefined ? formatStatLine(input.statLine) : undefined;
  return {
    displayName: `#${input.number} ${input.name}`,
    number: input.number,
    primaryColor: input.teamColors.primaryColor,
    secondaryColor: input.teamColors.secondaryColor,
    ...(statLineLabel !== undefined ? { statLineLabel } : {}),
  };
}
