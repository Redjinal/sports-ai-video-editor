// Scorebug templates: which elements a broadcast graphic shows, and where.
// Templates are pure configuration; `renderScorebug` (scorebug-view-model.ts) resolves
// a template + `ScoreboardState` into a display-ready view-model.
import { z } from "zod";

/** Normalized position anchor, 0..1 of frame width/height (resolution-independent). */
export const elementPositionSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});
export type ElementPosition = z.infer<typeof elementPositionSchema>;

export const scorebugElementConfigSchema = z.object({
  visible: z.boolean(),
  position: elementPositionSchema,
});
export type ScorebugElementConfig = z.infer<typeof scorebugElementConfigSchema>;

export const sponsorSlotSchema = z.object({
  assetId: z.string().min(1),
  position: elementPositionSchema,
  widthPx: z.number().positive().optional(),
  heightPx: z.number().positive().optional(),
});
export type SponsorSlot = z.infer<typeof sponsorSlotSchema>;

export const scorebugTemplateElementsSchema = z.object({
  score: scorebugElementConfigSchema,
  period: scorebugElementConfigSchema,
  gameClock: scorebugElementConfigSchema,
  possessionIndicator: scorebugElementConfigSchema,
  fouls: scorebugElementConfigSchema,
  timeouts: scorebugElementConfigSchema,
  bonus: scorebugElementConfigSchema,
  shotClock: scorebugElementConfigSchema,
});
export type ScorebugTemplateElements = z.infer<typeof scorebugTemplateElementsSchema>;

export const scorebugTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  elements: scorebugTemplateElementsSchema,
  sponsor: sponsorSlotSchema.optional(),
});
export type ScorebugTemplate = z.infer<typeof scorebugTemplateSchema>;

/** Validate an untrusted scorebug template payload at a persistence/UI boundary. */
export function parseScorebugTemplate(input: unknown): ScorebugTemplate {
  return scorebugTemplateSchema.parse(input);
}

function elementAt(x: number, y: number, visible: boolean): ScorebugElementConfig {
  return { visible, position: { x, y } };
}

/** A compact scorebug: score, period, and game clock only — no fouls/timeouts/bonus. */
export const minimalBug: ScorebugTemplate = {
  id: "minimal_bug",
  name: "Minimal",
  elements: {
    score: elementAt(0.02, 0.04, true),
    period: elementAt(0.16, 0.04, true),
    gameClock: elementAt(0.24, 0.04, true),
    possessionIndicator: elementAt(0.14, 0.04, false),
    fouls: elementAt(0.02, 0.08, false),
    timeouts: elementAt(0.02, 0.1, false),
    bonus: elementAt(0.02, 0.12, false),
    shotClock: elementAt(0.32, 0.04, false),
  },
};

/** A complete broadcast scorebug: every element visible, plus a sponsor slot. */
export const fullBug: ScorebugTemplate = {
  id: "full_bug",
  name: "Full Broadcast",
  elements: {
    score: elementAt(0.02, 0.04, true),
    period: elementAt(0.16, 0.04, true),
    gameClock: elementAt(0.24, 0.04, true),
    possessionIndicator: elementAt(0.14, 0.04, true),
    fouls: elementAt(0.02, 0.08, true),
    timeouts: elementAt(0.02, 0.1, true),
    bonus: elementAt(0.02, 0.12, true),
    shotClock: elementAt(0.32, 0.04, true),
  },
  sponsor: {
    assetId: "sponsor_default",
    position: { x: 0.85, y: 0.92 },
    widthPx: 220,
    heightPx: 60,
  },
};

export const BUILTIN_SCOREBUG_TEMPLATES = [minimalBug, fullBug] as const;
