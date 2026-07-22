# Basketball and Sports Workflows

> **Status:** Authoritative  
> **Authority:** Basketball editing workflow and sports-specific user experience  
> **Version:** 1.0  
> **Last updated:** 2026-07-22

## 1. Scope

Basketball is the first specialised sport. Phase 1 does not attempt general visual sports recognition or a full statistics platform.

This document defines how basketball-specific functions fit into the general editor. Data rules are defined in [`architecture/basketball-domain.md`](architecture/basketball-domain.md).

## 2. End-to-end game workflow

```text
Create basketball project
→ Enter game and optional roster information
→ Import and assign cameras/audio
→ Inspect and generate proxies
→ Synchronise camera group
→ Create multicam sequence
→ Transcribe commentary
→ Log periods, scores, fouls, and major events
→ Switch camera angles
→ Add scorebug, player graphics, sponsor assets, and captions
→ Create replay objects
→ Mix commentary, crowd, and music
→ Validate full-game edit
→ Export long-form master
→ Generate social proposal sequences
→ Approve, reframe, and export clips
```

## 3. Game setup

### Required information

- Home team
- Away team
- Team abbreviations
- Team colours
- Game title

### Optional information

- Team logos
- Game date
- Venue
- Competition/league
- Sponsor
- Notes
- Rosters
- Shot-clock configuration

### Rules preset

The basketball preset supplies editable defaults for:

- Number of periods
- Period duration
- Overtime duration
- Team-foul behaviour
- Bonus state
- Timeouts
- Shot-clock availability

The user may use a generic custom rules preset when the competition does not match a built-in default.

## 4. Media assignment

Video may be assigned as:

| Assignment | Typical use |
|---|---|
| Camera A | Main wide angle |
| Camera B | Baseline or close angle |
| Camera C | Opposite baseline or secondary wide |
| Camera D | Bench, crowd, roaming, or alternate angle |

Audio may be assigned as:

- Commentary
- Crowd/venue
- Camera reference audio
- Music
- Sound effects
- Unassigned

Assignments are metadata. They do not move or copy files by themselves.

## 5. Ingest and proxy preparation

Before editing, the editor should:

1. Inspect codec, duration, resolution, frame rate, and audio.
2. Report compatibility tier.
3. Estimate proxy and cache storage.
4. Warn when disk space is insufficient.
5. Generate requested proxies.
6. Create thumbnails and waveforms.
7. Retain original file references for final render.
8. Permit deferred proxy generation.

For long-form four-camera projects, the default recommendation is a lightweight 720p proxy unless hardware and storage justify 1080p.

## 6. Multicam synchronisation

### Methods

- Audio waveform
- Source timecode
- Manual sync markers
- Manual offset

### Workflow

1. Select two to four camera assets or sequential camera groups.
2. Choose the primary reference angle.
3. Select a sync method.
4. Review alignment confidence.
5. Preview multiple sync points.
6. Correct offsets where required.
7. Lock the camera group.
8. Create the multicam sequence.

### Interrupted cameras

A camera that stops and restarts remains one logical angle with multiple source segments. Gaps must be explicit. The system must not stretch or fabricate footage to hide them.

### Resynchronisation

Resynchronising one angle must preserve approved angle edits where matching source time remains valid. When a switch becomes invalid, the editor must flag it rather than silently selecting another angle.

## 7. Live camera switching

During multicam playback:

- `1` selects Camera A.
- `2` selects Camera B.
- `3` selects Camera C.
- `4` selects Camera D.

Each switch creates an editable angle cut.

The user may later:

- Move a switch point
- Replace an active angle
- Remove a switch
- Open the source angle
- Select the multicam audio source
- Lock approved sections

AI may suggest switch points but cannot apply them to the approved master without user action.

## 8. Event logging

### Phase 1 event types

- Two-point made
- Three-point made
- Free throw made
- Shot missed
- Rebound
- Assist
- Steal
- Block
- Turnover
- Foul
- Timeout
- Substitution
- Period start
- Period end
- Overtime start
- Replay
- Crowd reaction
- Commentary highlight
- Custom marker

### Event entry

The event logger provides:

- Current period
- Current game clock
- Current score
- Team
- Primary player
- Secondary player where relevant
- Event type
- Notes
- Include/exclude from statistics

Event creation defaults to the playhead. The user can correct timeline time or game clock.

### Scoring

Approved made-shot events update the calculated score:

- Free throw: 1
- Two-point made: 2
- Three-point made: 3

An AI-suggested scoring event does not affect the official score until approved.

## 9. Score corrections

Corrections are explicit records.

Supported actions:

- Add missing scoring event
- Correct event team
- Correct point value
- Mark event void
- Add score adjustment with reason

The editor must retain correction history. It must not silently rewrite earlier event records.

## 10. Game clock workflow

### Initial anchor

At the start of each period, the user maps:

- Timeline time
- Period
- Displayed game time
- Running/stopped state

### Correction anchors

Additional anchors can be added after:

- Camera interruption
- Broadcast cut
- Missing footage
- Timeout
- Dead-ball edit
- Clock drift
- Incorrect initial synchronisation

The clock is piecewise mapped. It is not assumed to count down continuously through edited or missing footage.

## 11. Basic statistics

Phase 1 calculates:

- Player points from approved scoring events
- Team score
- Team foul count
- Major event list

It does not calculate a full box score or infer statistics from video.

Events may be excluded from statistics while remaining as timeline markers.

## 12. Broadcast scorebug

### Data fields

- Home and away names
- Abbreviations
- Logos
- Colours
- Score
- Period
- Game clock
- Possession
- Team fouls
- Timeouts
- Bonus
- Optional shot clock
- Sponsor

### Separation of data and design

Game state and graphics template are separate:

```text
Basketball state
→ Scorebug view model
→ Selected visual template
→ Timeline graphic object
```

Changing the template must not change score data. Correcting score data updates every bound scorebug instance unless the instance is explicitly detached.

## 13. Player and sponsor graphics

### Player lower third

May display:

- Name
- Number
- Position
- Team
- Player image
- Optional basic points

### Sponsor assets

Sponsor graphics can be:

- Static corner placement
- Lower-third sponsor lockup
- Replay bumper sponsor
- Full-screen card

The user controls duration and placement. No automatic ad insertion is included.

## 14. Replay workflow

1. Mark a source or master timeline range.
2. Choose **Create Replay**.
3. The editor creates a specialised nested sequence.
4. Select 0.25×, 0.5×, 1×, or 2×.
5. Choose source, muted, commentary, or custom audio.
6. Optionally apply a replay bumper.
7. Preview.
8. Confirm insertion into the master.

Replay objects remain linked to their source range and can be retrimmed.

AI may suggest replay ranges, but insertion requires user approval.

## 15. Transcript-assisted sports navigation

The transcript can help locate:

- Player names
- Team names
- “three”, “and one”, “timeout”, “foul”, or similar commentary phrases
- Excited commentary
- Period references
- Interview or post-game segments

Keyword matches are supporting signals, not official event truth.

## 16. Highlight proposal workflow

### Inputs

- Approved basketball events
- Score changes
- Manual markers
- Period boundaries
- Commentary intensity
- Crowd-volume change
- Transcript keywords
- Replay markers
- Selected player/team/event scope
- Desired duration and aspect ratio

### Output

AI creates separate proposal sequences such as:

- Top Plays
- Three-Point Highlights
- Home Team Highlights
- Away Team Highlights
- Player Highlights
- Best Commentary Moments
- Crowd Reactions
- Game Recap
- 9:16 Social Clips
- 1:1 Social Clips
- 4:5 Social Clips
- 16:9 Highlight Package

Each proposal links back to the source sequence and displays evidence.

## 17. Social reframing

Phase 1 supports:

- 16:9
- 9:16
- 1:1
- 4:5

The initial reframe can be manually created or AI-suggested. Full player tracking is excluded, so the user must be able to keyframe framing corrections.

A social sequence is independent from the master. The user chooses whether later master changes propagate.

## 18. Long-form export checklist

Before full-game export, the editor should surface:

- Offline or proxy-only media
- Unresolved multicam gaps
- Unapproved AI events affecting proposals
- Score corrections
- Clock discontinuities
- Missing fonts or graphics
- Caption gaps
- Peak audio warnings
- Unsupported export settings
- Estimated output storage

Warnings do not all block export, but missing media, invalid sequence state, and unavailable codec paths do.

## 19. Failure and recovery scenarios

The sports workflow must handle:

- One camera missing
- One camera with interrupted files
- Commentary recorded separately
- Audio waveform sync failure
- Incorrect team assignment
- Score logged to wrong team
- Missing period anchor
- Imported roster with duplicate numbers
- Scorebug asset missing
- Replay source moved or offline
- AI proposal based on a later-corrected event
- Proxy available while original is offline

The system should preserve user work and make inconsistencies visible.

## 20. Acceptance scenarios

### AS-SPORT-01 — Four-camera game

A four-camera game can be synchronised, switched, refined, saved, reopened, and exported without losing angle edits.

### AS-SPORT-02 — Score correction

A three-point event entered for the wrong team can be corrected. The scorebug, player points, team score, and proposal evidence update consistently, and undo restores the previous state.

### AS-SPORT-03 — Clock discontinuity

A clock anchor added after missing footage produces a correct displayed clock before and after the discontinuity.

### AS-SPORT-04 — Replay

A selected play can be inserted as a 0.5× nested replay with a bumper and commentary audio. Retrimming the replay does not alter the source.

### AS-SPORT-05 — Social proposal isolation

AI generates vertical clips from approved scoring events without modifying the approved master. Accepting one proposal is undoable.

## 21. Later sports expansion

Adding another sport requires a documented scope decision covering:

- Rules and periods
- Event vocabulary
- Scoring model
- Clock model
- Statistics
- Graphics
- Import schema
- Highlight signals
- Test fixtures

Basketball assumptions must not be embedded in the platform-neutral timeline domain.
