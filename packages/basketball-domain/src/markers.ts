// Event -> timeline marker conversion (M8 basketball domain).
// Output matches the timeline-domain Marker shape (id, atTicks, label, optional color) so it
// can be dropped directly into a Sequence's markers array. We define a locally-compatible
// type rather than importing timeline-domain's Marker: this package only depends on
// ticks.ts exports from @sve/timeline-domain (see index.ts / package README notes).
import type { Ticks } from "@sve/timeline-domain";
import type { GameEvent, GameEventType, GameLog } from "./events";

export interface DomainMarker {
  id: string;
  atTicks: Ticks;
  label: string;
  color?: string;
}

export interface EventsToMarkersOptions {
  /** Override the default per-type marker color. */
  colors?: Partial<Record<GameEventType, string>>;
  /** Prefix for generated marker ids (default: "marker-"). */
  idPrefix?: string;
}

const DEFAULT_COLORS: Record<GameEventType, string> = {
  score: "#22c55e",
  foul: "#ef4444",
  timeout: "#eab308",
  substitution: "#3b82f6",
  periodStart: "#a855f7",
  periodEnd: "#a855f7",
  custom: "#94a3b8",
  adjustment: "#f97316",
};

function labelFor(ev: GameEvent): string {
  switch (ev.type) {
    case "score":
      return `+${ev.points} pts`;
    case "foul":
      return `Foul (${ev.kind})`;
    case "timeout":
      return "Timeout";
    case "substitution":
      return "Substitution";
    case "periodStart":
      return `Period ${ev.period} start`;
    case "periodEnd":
      return `Period ${ev.period} end`;
    case "custom":
      return ev.label;
    case "adjustment":
      return `Score correction (${ev.points >= 0 ? "+" : ""}${ev.points})`;
  }
}

/** Convert an event log into timeline markers, one per event, in log order. */
export function eventsToMarkers(log: GameLog, opts: EventsToMarkersOptions = {}): DomainMarker[] {
  const colors: Record<GameEventType, string> = { ...DEFAULT_COLORS, ...opts.colors };
  const idPrefix = opts.idPrefix ?? "marker-";
  return log.map((ev) => ({
    id: `${idPrefix}${ev.id}`,
    atTicks: ev.atTicks,
    label: labelFor(ev),
    color: colors[ev.type],
  }));
}
