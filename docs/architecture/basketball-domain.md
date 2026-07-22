# Basketball Domain

> **Status:** Authoritative  
> **Authority:** Basketball entities, events, scoring, clock, basic statistics, imports, and scorebug state  
> **Version:** 1.0  
> **Last updated:** 2026-07-22

## 1. Goals

The basketball domain must:

- Represent one game per basketball context
- Support editable teams and optional rosters
- Record approved, imported, manual, and suggested events
- Calculate score from approved scoring events
- Preserve correction history
- Map timeline time to game clock using anchors
- Calculate basic player points and team fouls
- Drive scorebug state
- Support highlight evidence
- Remain separate from timeline UI and media engines

## 2. Non-goals

Phase 1 does not provide:

- Full official box score
- Visual event recognition
- Automatic scoreboard reading
- Player or ball tracking
- League platform integration
- Live game operation
- Referee administration
- Standings or season statistics

## 3. Game context

```ts
interface BasketballGame {
  id: string;
  title: string;
  date?: string;
  venue?: string;
  competition?: string;
  sponsor?: string;
  homeTeamId: string;
  awayTeamId: string;
  rules: BasketballRules;
  rosterIds: string[];
  eventIds: string[];
  clockAnchorIds: string[];
}
```

## 4. Team

```ts
interface BasketballTeam {
  id: string;
  name: string;
  abbreviation: string;
  primaryColour: string;
  secondaryColour?: string;
  logoAssetId?: string;
}
```

Rules:

- Home and away IDs must differ.
- Abbreviation is editable.
- Colours must meet graphic contrast guidance when used directly.
- Logo absence does not block game creation.

## 5. Player

```ts
interface BasketballPlayer {
  id: string;
  teamId: string;
  name: string;
  jerseyNumber?: string;
  position?: string;
  imageAssetId?: string;
  active: boolean;
}
```

Jersey number is a string to permit competition-specific values. Duplicate numbers are warned, not universally prohibited, because roster data may include inactive or duplicate records.

## 6. Rules

```ts
interface BasketballRules {
  periodCount: number;
  periodDurationTicks: number;
  overtimeDurationTicks: number;
  shotClockEnabled: boolean;
  teamFoulBonusThreshold?: number;
  timeoutConfiguration?: Record<string, number>;
}
```

Defaults are presets. The user may customise them.

## 7. Event source and approval

```ts
type EventSource = "manual" | "imported" | "ai_suggestion";
type EventStatus = "approved" | "suggested" | "void";
```

Rules:

- Manual events default to approved unless entered in draft mode.
- Imported events require validation and may be approved in batch.
- AI events always begin suggested.
- Suggested or void events do not affect official score/statistics.
- Approval is reversible.

## 8. Event types

```ts
type BasketballEventType =
  | "two_point_made"
  | "three_point_made"
  | "free_throw_made"
  | "shot_missed"
  | "rebound"
  | "assist"
  | "steal"
  | "block"
  | "turnover"
  | "foul"
  | "timeout"
  | "substitution"
  | "period_start"
  | "period_end"
  | "overtime_start"
  | "replay"
  | "crowd_reaction"
  | "commentary_highlight"
  | "score_adjustment"
  | "custom";
```

## 9. Event model

```ts
interface BasketballEvent {
  id: string;
  gameId: string;
  timelineTicks: number;
  sourceTicks?: number;
  period: number;
  gameClockTicks?: number;
  type: BasketballEventType;
  teamId?: string;
  primaryPlayerId?: string;
  secondaryPlayerId?: string;
  points?: 1 | 2 | 3;
  source: EventSource;
  status: EventStatus;
  confidence?: number;
  notes?: string;
  correctionOfEventId?: string;
  createdAt: string;
}
```

## 10. Event validation

Examples:

- `two_point_made` requires a team and points=2.
- `three_point_made` requires a team and points=3.
- `free_throw_made` requires a team and points=1.
- A player must belong to the selected team.
- Period must be valid for the rules or an explicit overtime period.
- Timeline ticks cannot be negative.
- Game-clock ticks cannot be negative or exceed the configured period duration without an explicit custom-rules warning.
- AI confidence is optional and does not change approval.

## 11. Score calculation

Official score at timeline time `T`:

1. Select approved, non-void scoring and adjustment events at or before `T`.
2. Order by timeline time, then stable event order.
3. Sum points by team.
4. Apply explicit score adjustments.
5. Return score and provenance.

Score is derived. Do not store unrelated authoritative score fields on each timeline frame or scorebug object.

## 12. Automatic score update

Logging an approved made basket automatically changes calculated score and scorebug state.

The event logger should preview:

- Score before
- Event value
- Score after

Undoing the event restores the previous score.

## 13. Score corrections

Preferred correction order:

1. Correct the original event when it was entered incorrectly.
2. Add a missing scoring event.
3. Mark an invalid event void.
4. Use `score_adjustment` only when event-level correction is impossible or imported truth requires it.

A correction record contains:

- Target event where applicable
- Reason
- Previous value
- New value
- User action timestamp

Historical records remain traceable.

## 14. Event ordering

Two events may share timeline ticks.

Stable ordering uses:

- Timeline ticks
- User-defined event order at the same tick
- Creation order as final fallback

The user can reorder same-time events when score display order matters.

## 15. Clock anchors

```ts
interface GameClockAnchor {
  id: string;
  gameId: string;
  period: number;
  timelineTicks: number;
  gameClockTicks: number;
  state: "running" | "stopped";
  source: EventSource;
  status: EventStatus;
  notes?: string;
}
```

AI-suggested anchors are not official until approved.

## 16. Clock evaluation

Clock mapping is piecewise.

For a running segment after an approved anchor:

```text
displayed clock = anchor game clock - elapsed timeline time
```

For a stopped segment:

```text
displayed clock = anchor game clock
```

A later anchor begins a new segment and corrects drift/discontinuity.

The evaluator must handle:

- Missing footage
- Edited dead time
- Broadcast cuts
- Camera interruptions
- Period boundaries
- Manual corrections

It must not infer continuous countdown across a gap without a valid mapping.

## 17. Period state

Period start/end events and anchors help determine:

- Current period
- Clock format
- Scorebug period label
- Highlight grouping

A period can exist without complete clock mapping, but the UI must show unknown clock state rather than invent a value.

## 18. Basic statistics

Derived Phase 1 statistics:

- Player points
- Team score
- Team foul count
- Event counts by type
- Major event list

### Fouls

A foul counts toward team fouls when:

- Status is approved
- Team is present
- Event is not explicitly excluded from statistics

The domain does not infer personal/team foul rule nuances beyond configured Phase 1 behaviour.

## 19. Rebounds, assists, and other events

These events are logged and searchable but need not produce a complete official statistical table.

Player and secondary-player relationships:

- Assist may reference scorer and assisting player.
- Substitution may reference outgoing and incoming players.
- Custom events may omit players.

## 20. Scorebug view model

```ts
interface ScorebugState {
  home: TeamDisplayState;
  away: TeamDisplayState;
  homeScore: number;
  awayScore: number;
  periodLabel: string;
  gameClock?: string;
  possessionTeamId?: string;
  homeFouls?: number;
  awayFouls?: number;
  homeTimeouts?: number;
  awayTimeouts?: number;
  bonusHome?: boolean;
  bonusAway?: boolean;
  shotClock?: string;
  sponsorAssetId?: string;
}
```

The view model is evaluated at timeline time and bound to a graphic template.

## 21. Possession, timeout, bonus, and shot clock

Phase 1 allows manual state records or events for these fields where implemented.

The domain must distinguish:

- Known state
- Unknown state
- Not configured

It must not display `0` when the value is unknown.

## 22. Imports

### CSV roster minimum fields

- Team
- Player name
- Jersey number
- Position
- Image path or URL optional

### JSON roster

Supports the full player model and team mapping.

### Event JSON

Event import is supported by the domain contract even if UI rollout follows basketball milestone sequencing.

Import requirements:

- Field mapping
- Preview
- Validation
- Duplicate detection
- Timebase mapping
- Approval state selection
- Atomic import

## 23. Duplicate detection

Potential duplicate event signals:

- Same type
- Same team/player
- Same or near timeline time
- Same game clock and period
- Same imported external ID

Duplicates are reviewed, not silently merged.

## 24. Timeline binding

An event belongs to a basketball game context and has timeline time.

Optional bindings:

- Source asset/time
- Sequence marker
- Clip
- Replay
- Transcript segment

Deleting a clip does not delete the event. An event may become unbound and requires review.

## 25. AI suggestions

AI may suggest:

- Event type
- Time/range
- Team/player candidates
- Confidence
- Evidence

It may not:

- Approve its event
- Change score
- Change clock
- Replace a manual event

When an approved event changes, dependent AI proposals are marked stale.

## 26. Invariants

- Game has distinct home and away teams.
- Approved scoring events have valid point values and team.
- Approved player references belong to a game roster/team.
- Clock anchors have valid period and non-negative time.
- Suggested events never affect official derived state.
- Corrections preserve provenance.
- Score cannot be negative unless a custom score adjustment explicitly permits and warns.
- Derived state is deterministic.

## 27. Undo and transactions

The following are atomic and reversible:

- Add event
- Approve suggestion
- Correct event
- Void event
- Import event batch
- Add/correct clock anchor
- Update roster mapping

Undo must restore score, statistics, scorebug state, and proposal staleness consistently.

## 28. Tests

Required:

- 1/2/3-point scoring
- Same-time event ordering
- Wrong-team correction
- Void event
- Score adjustment
- AI suggestion approval
- Player points
- Team fouls
- Period transitions
- Running/stopped clock
- Multiple clock correction anchors
- Missing clock mapping
- CSV/JSON validation
- Duplicate detection
- Timeline deletion leaving unbound event
- Save/reopen
- Undo/redo
- Scorebug view model
