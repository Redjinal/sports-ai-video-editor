// Roster: players and CSV/JSON import (M8 basketball domain).
// Import is pure and never throws on malformed input — it returns a structured
// result with per-row errors, so a UI can show exactly which rows failed and why.
import { z } from "zod";

export const PLAYER_POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;
export type PlayerPosition = (typeof PLAYER_POSITIONS)[number];

export const playerSchema = z.object({
  id: z.string().min(1),
  teamId: z.string().min(1),
  number: z.number().int().nonnegative(),
  name: z.string().min(1),
  position: z.enum(PLAYER_POSITIONS).optional(),
});
export type Player = z.infer<typeof playerSchema>;

/** Deterministic id for a player derived from team + jersey number (used when a row omits one). */
export function playerId(teamId: string, number: number): string {
  return `${teamId}#${number}`;
}

export interface RosterImportError {
  /** 1-based CSV line number, or 1-based JSON array index; 0 for whole-input errors. */
  line: number;
  message: string;
}

export interface RosterImportResult {
  players: Player[];
  errors: RosterImportError[];
}

export interface RosterImportOptions {
  /** Team id to apply to rows that don't specify their own teamId column/field. */
  teamId?: string;
}

function lowerKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    out[key.toLowerCase()] = value;
  }
  return out;
}

/** Normalize one raw row (from CSV cells or a JSON object) into a validated Player. */
function normalizeRosterRow(
  rawInput: Record<string, unknown>,
  options?: RosterImportOptions,
): { success: true; data: Player } | { success: false; message: string } {
  const raw = lowerKeys(rawInput);

  const rowTeamId =
    typeof raw.teamid === "string" && raw.teamid.trim() !== "" ? raw.teamid.trim() : undefined;
  const teamId = rowTeamId ?? options?.teamId;
  if (!teamId) {
    return { success: false, message: "Missing teamId and no default team was provided" };
  }

  const numberRaw = raw.number;
  const number = typeof numberRaw === "number" ? numberRaw : Number(numberRaw);

  const name = typeof raw.name === "string" ? raw.name.trim() : "";

  const idRaw = typeof raw.id === "string" && raw.id.trim() !== "" ? raw.id.trim() : undefined;
  const id = idRaw ?? playerId(teamId, Number.isFinite(number) ? number : Number.NaN);

  const positionRaw =
    typeof raw.position === "string" && raw.position.trim() !== ""
      ? raw.position.trim().toUpperCase()
      : undefined;

  const candidate: Record<string, unknown> = { id, teamId, number, name };
  if (positionRaw !== undefined) {
    candidate.position = positionRaw;
  }

  const parsed = playerSchema.safeParse(candidate);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`)
      .join("; ");
    return { success: false, message };
  }
  return { success: true, data: parsed.data };
}

/** Split one CSV line into trimmed cells. No quoted-field support (not needed by roster CSVs). */
function splitCsvLine(line: string): string[] {
  return line.split(",").map((cell) => cell.trim());
}

/**
 * Parse a CSV roster export into players. Expected header columns (case-insensitive, any
 * order): id (optional), teamId (optional if `options.teamId` is given), number, name,
 * position (optional). Rows that fail validation are reported in `errors` and excluded
 * from `players`; parsing never throws.
 */
export function parseRosterCsv(input: string, options?: RosterImportOptions): RosterImportResult {
  const rawLines = input.split(/\r\n|\r|\n/);
  // Drop a single trailing blank line (common with editor-saved files) without disturbing
  // interior blank-line line numbers.
  const lines =
    rawLines.length > 0 && rawLines[rawLines.length - 1]?.trim() === ""
      ? rawLines.slice(0, -1)
      : rawLines;

  if (lines.length === 0 || lines[0]?.trim() === "") {
    return { players: [], errors: [{ line: 0, message: "CSV input is empty" }] };
  }

  const header = splitCsvLine(lines[0] ?? "").map((h) => h.toLowerCase());
  const requiredColumns = ["number", "name"];
  const missing = requiredColumns.filter((col) => !header.includes(col));
  if (missing.length > 0) {
    return {
      players: [],
      errors: [
        { line: 1, message: `CSV header missing required column(s): ${missing.join(", ")}` },
      ],
    };
  }

  const players: Player[] = [];
  const errors: RosterImportError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "") continue;
    const cells = splitCsvLine(line);
    const raw: Record<string, string> = {};
    header.forEach((col, idx) => {
      raw[col] = cells[idx] ?? "";
    });
    const result = normalizeRosterRow(raw, options);
    if (result.success) {
      players.push(result.data);
    } else {
      errors.push({ line: i + 1, message: result.message });
    }
  }

  return { players, errors };
}

/**
 * Parse a JSON roster export (an array of player-like objects) into players. Field names
 * are matched case-insensitively, mirroring `parseRosterCsv`. Parsing never throws.
 */
export function parseRosterJson(input: string, options?: RosterImportOptions): RosterImportResult {
  let data: unknown;
  try {
    data = JSON.parse(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { players: [], errors: [{ line: 0, message: `Invalid JSON: ${message}` }] };
  }

  if (!Array.isArray(data)) {
    return { players: [], errors: [{ line: 0, message: "Expected a JSON array of players" }] };
  }

  const players: Player[] = [];
  const errors: RosterImportError[] = [];

  data.forEach((item: unknown, idx: number) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      errors.push({ line: idx + 1, message: "Expected a JSON object for each player" });
      return;
    }
    const result = normalizeRosterRow(item as Record<string, unknown>, options);
    if (result.success) {
      players.push(result.data);
    } else {
      errors.push({ line: idx + 1, message: result.message });
    }
  });

  return { players, errors };
}

/** Add a player to a roster. Throws if a player with the same id already exists. */
export function addPlayer(roster: readonly Player[], player: Player): Player[] {
  if (roster.some((p) => p.id === player.id)) {
    throw new Error(`Player ${player.id} already exists in the roster`);
  }
  return [...roster, player];
}

/** Edit an existing player's fields (id and teamId are immutable). Returns a new roster. */
export function editPlayer(
  roster: readonly Player[],
  playerIdToEdit: string,
  patch: Partial<Omit<Player, "id" | "teamId">>,
): Player[] {
  const exists = roster.some((p) => p.id === playerIdToEdit);
  if (!exists) {
    throw new Error(`Player ${playerIdToEdit} not found in the roster`);
  }
  return roster.map((p) => (p.id === playerIdToEdit ? { ...p, ...patch } : p));
}

/** Remove a player from a roster. Returns a new roster. */
export function removePlayer(roster: readonly Player[], playerIdToRemove: string): Player[] {
  const next = roster.filter((p) => p.id !== playerIdToRemove);
  if (next.length === roster.length) {
    throw new Error(`Player ${playerIdToRemove} not found in the roster`);
  }
  return next;
}
