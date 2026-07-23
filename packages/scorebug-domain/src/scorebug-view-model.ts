// Derive a display-ready scorebug view-model from a template + scoreboard state.
// Pure and deterministic: the view-model is derived, never authoritative — the score,
// clock, fouls, etc. on `ScoreboardState` remain the source of truth.
import { formatGameClock, formatPeriodLabel, formatShotClock } from "./clock-format";
import type { ElementPosition, ScorebugTemplate } from "./scorebug-template";
import type { Possession, ScoreboardState, TeamState } from "./scoreboard-state";

export interface TeamDisplay {
  name: string;
  abbreviation: string;
  logoAssetId?: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface ScoreElement {
  visible: boolean;
  position: ElementPosition;
  home: number;
  away: number;
}

export interface LabelElement {
  visible: boolean;
  position: ElementPosition;
  label: string;
}

export interface PossessionElement {
  visible: boolean;
  position: ElementPosition;
  value: Possession;
}

export interface TeamCountElement {
  visible: boolean;
  position: ElementPosition;
  home: number;
  away: number;
}

export interface BonusElement {
  visible: boolean;
  position: ElementPosition;
  home: boolean;
  away: boolean;
}

export interface SponsorElement {
  assetId: string;
  position: ElementPosition;
  widthPx?: number;
  heightPx?: number;
}

export interface ScorebugViewModel {
  templateId: string;
  templateName: string;
  teams: { home: TeamDisplay; away: TeamDisplay };
  score: ScoreElement;
  period: LabelElement;
  gameClock: LabelElement;
  possession: PossessionElement;
  fouls: TeamCountElement;
  timeouts: TeamCountElement;
  bonus: BonusElement;
  /** Only present when the source state carries shot-clock data. */
  shotClock?: LabelElement;
  /** Only present when the template defines a sponsor slot. */
  sponsor?: SponsorElement;
}

function teamDisplay(team: TeamState): TeamDisplay {
  return {
    name: team.name,
    abbreviation: team.abbreviation,
    ...(team.logoAssetId !== undefined ? { logoAssetId: team.logoAssetId } : {}),
    primaryColor: team.primaryColor,
    secondaryColor: team.secondaryColor,
  };
}

/** Resolve a `ScorebugTemplate` against a `ScoreboardState` into a display-ready view-model. */
export function renderScorebug(
  template: ScorebugTemplate,
  state: ScoreboardState,
): ScorebugViewModel {
  const shotClock: LabelElement | undefined =
    state.shotClockMs !== undefined
      ? {
          visible: template.elements.shotClock.visible,
          position: template.elements.shotClock.position,
          label: formatShotClock(state.shotClockMs),
        }
      : undefined;

  const sponsor: SponsorElement | undefined =
    template.sponsor !== undefined
      ? {
          assetId: template.sponsor.assetId,
          position: template.sponsor.position,
          ...(template.sponsor.widthPx !== undefined ? { widthPx: template.sponsor.widthPx } : {}),
          ...(template.sponsor.heightPx !== undefined
            ? { heightPx: template.sponsor.heightPx }
            : {}),
        }
      : undefined;

  return {
    templateId: template.id,
    templateName: template.name,
    teams: {
      home: teamDisplay(state.home),
      away: teamDisplay(state.away),
    },
    score: {
      visible: template.elements.score.visible,
      position: template.elements.score.position,
      home: state.home.score,
      away: state.away.score,
    },
    period: {
      visible: template.elements.period.visible,
      position: template.elements.period.position,
      label: formatPeriodLabel(state.period),
    },
    gameClock: {
      visible: template.elements.gameClock.visible,
      position: template.elements.gameClock.position,
      label: formatGameClock(state.gameClockMs),
    },
    possession: {
      visible: template.elements.possessionIndicator.visible,
      position: template.elements.possessionIndicator.position,
      value: state.possession,
    },
    fouls: {
      visible: template.elements.fouls.visible,
      position: template.elements.fouls.position,
      home: state.home.fouls,
      away: state.away.fouls,
    },
    timeouts: {
      visible: template.elements.timeouts.visible,
      position: template.elements.timeouts.position,
      home: state.home.timeoutsRemaining,
      away: state.away.timeoutsRemaining,
    },
    bonus: {
      visible: template.elements.bonus.visible,
      position: template.elements.bonus.position,
      home: state.home.inBonus,
      away: state.away.inBonus,
    },
    ...(shotClock !== undefined ? { shotClock } : {}),
    ...(sponsor !== undefined ? { sponsor } : {}),
  };
}
