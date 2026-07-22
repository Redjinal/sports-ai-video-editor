# Design System

> **Status:** Authoritative  
> **Authority:** Visual language, interaction conventions, layout, and accessibility  
> **Version:** 1.0  
> **Last updated:** 2026-07-22

## 1. Design direction

The editor should feel like a modern broadcast control room rather than a clone of VEED, CapCut, Premiere Pro, or a generic SaaS dashboard.

The desired character is:

- Dark
- Timeline-dominant
- Dense but orderly
- Precise
- Broadcast-aware
- Calm during long sessions
- Clear about background work and system state
- Distinctive without novelty that slows editing

## 2. Experience hierarchy

1. Timeline and playhead state
2. Program viewer
3. Current selection and properties
4. Media/transcript/sports tool
5. Job and save state
6. Secondary navigation

Decorative branding must never compete with the playhead, selection, warnings, or export state.

## 3. Layout system

### Desktop default

```text
┌──────────────────────────────────────────────────────────────┐
│ App bar                                                      │
├──────┬──────────────────────────────┬────────────────────────┤
│ Rail │ Central viewer               │ Inspector              │
│ +    │                              │                        │
│ tool │                              │                        │
├──────┴──────────────────────────────┴────────────────────────┤
│ Timeline toolbar                                             │
├──────────────────────────────────────────────────────────────┤
│ Timeline                                                     │
└──────────────────────────────────────────────────────────────┘
```

### Minimum DeX layout

At `1280 × 800`:

- Left rail remains visible.
- Only one expanded side panel is persistent.
- Inspector may overlay.
- Timeline height is at least 260 px.
- Timeline can expand to 70% of vertical space.
- Viewer remains usable for 16:9 preview.
- Panel controls remain keyboard, mouse, and touch accessible.

### Panel behaviour

- Panels are resizable and collapsible.
- Resize handles have at least a 6 px visual or hit zone and larger touch hit area.
- Double-clicking a divider restores default size.
- The active panel persists per workspace.
- Panel collapse must not discard unsaved field edits.

## 4. Colour system

The initial palette uses neutral charcoal surfaces with cool broadcast accents and warm event accents. Exact branding may change after a product name is selected, so components must use semantic tokens.

```css
:root {
  --surface-canvas: #0a0d12;
  --surface-app: #10151d;
  --surface-panel: #151b24;
  --surface-raised: #1c2430;
  --surface-hover: #25303d;
  --surface-selected: #1e3442;

  --text-primary: #f2f5f7;
  --text-secondary: #aeb8c4;
  --text-muted: #778391;
  --text-inverse: #081016;

  --accent-primary: #56d6e8;
  --accent-primary-strong: #7ce8f4;
  --accent-sport: #ffb84d;
  --accent-ai: #b7a0ff;

  --state-success: #56c596;
  --state-warning: #ffcc66;
  --state-error: #ff7272;
  --state-info: #72b7ff;

  --border-subtle: #27313c;
  --border-strong: #3a4755;
  --focus-ring: #8eeaf4;
}
```

Rules:

- Never encode state through colour alone.
- AI uses a consistent purple-family semantic accent plus an AI label/icon.
- Basketball events use event icons and labels in addition to warm accent colour.
- Errors and destructive actions are visually distinct.
- Track colours are user-adjustable but must preserve readable text contrast.

## 5. Typography

### Interface

Preferred stack:

```css
font-family:
  Inter,
  "Segoe UI",
  Roboto,
  Arial,
  sans-serif;
```

### Timecode and numeric data

```css
font-family:
  "IBM Plex Mono",
  "Cascadia Mono",
  Consolas,
  monospace;
```

Do not require bundled fonts for the application to remain usable.

### Scale

| Token | Size | Use |
|---|---:|---|
| `text-xs` | 11 px | Dense metadata |
| `text-sm` | 12 px | Timeline labels, controls |
| `text-md` | 14 px | Standard UI |
| `text-lg` | 16 px | Panel headings |
| `text-xl` | 20 px | Screen title |
| `text-display` | 28 px | Empty state or onboarding |

Minimum interactive text is 12 px at 100% scale. Users may increase interface scale.

## 6. Spacing and sizing

Use a 4 px base grid.

| Token | Value |
|---|---:|
| `space-1` | 4 px |
| `space-2` | 8 px |
| `space-3` | 12 px |
| `space-4` | 16 px |
| `space-5` | 24 px |
| `space-6` | 32 px |

Minimum pointer target:

- Desktop mouse: 28 × 28 px
- Touch-capable DeX: 40 × 40 px hit area for primary controls
- Timeline trim handles may look smaller but require enlarged invisible hit zones

## 7. Shape, border, and elevation

- Standard radius: 6 px
- Compact control radius: 4 px
- Modal/card radius: 10 px
- Timeline clips use 4 px radius or square edges at tight zoom.
- Borders are preferred over heavy shadows inside the editor.
- Floating menus, overlays, and modals may use restrained elevation.
- Focus rings are never removed.

## 8. Iconography

- Use one consistent outline icon family.
- Prefer recognisable editing conventions.
- Pair unfamiliar sports or AI icons with text labels.
- Camera angles use A–D and optionally 1–4.
- Destructive icons require text in menus.
- Do not use brand logos as generic connector icons unless permitted by the provider.

## 9. Timeline visual grammar

### Clips

A clip shows, subject to zoom:

- Name
- Media type icon
- Thumbnail or waveform
- Proxy/offline badge
- Linked status
- Effect/keyframe indicator
- Nested/multicam/replay indicator

### Selection

Selected objects use:

- High-contrast border
- Visible handles
- Selection count for multi-select
- Inspector context
- Accessible selection announcement

### Playhead

- Highest-contrast persistent timeline element
- Extends through ruler and tracks
- Timecode visible during drag
- Snapping feedback visible and audible only if enabled

### Markers and basketball events

- Distinct shapes for general marker, event, clock anchor, and AI suggestion
- Tooltip with time, period, score, type, source, and notes
- AI suggestions are visually dashed or otherwise provisional
- Approved events are solid

### Transitions

Transitions are separate visible objects with their own handles and duration.

### Track headers

Track header includes:

- Name
- Type
- Lock
- Visibility or mute
- Solo where applicable
- Height
- Targeting state
- Colour

## 10. AI interaction design

AI state must be explicit:

- Analysis in progress
- Evidence available
- Confidence
- Proposal only
- Accepted
- Rejected
- Modified after acceptance
- Stale because source data changed

Proposal cards include:

- Action
- Scope
- Source range
- Confidence
- Evidence
- Duration
- Preview
- Accept/reject/modify

No AI action may use ambiguous destructive copy such as “Clean up” without describing the exact proposed changes.

## 11. Basketball interaction design

The event logger prioritises rapid keyboard and mouse entry.

- Current period, clock, and score remain pinned.
- Home and away actions are spatially separated.
- Made-shot buttons display point value.
- Player selection supports recent players and number search.
- Correction actions are visually distinct from new events.
- The scorebug preview updates immediately from approved state.
- An AI-suggested event is clearly provisional.

## 12. Forms and validation

- Validate on blur and submit, not on every keystroke for long fields.
- Preserve entered values after failure.
- Error text states cause and recovery.
- Destructive confirmations name the affected project or asset.
- Codec and media warnings use plain language and an advanced-details disclosure.
- Field mapping previews records before CSV/JSON import.

## 13. Empty, loading, and error states

Every major screen or panel requires:

- Empty state with a primary action
- Loading state that preserves layout
- Partial-result state
- Recoverable error
- Non-recoverable error with diagnostic code
- Offline or credential-expired state where relevant

Avoid indefinite spinners. Long jobs show progress, current stage, cancellation, and where possible estimated work units without unreliable time promises.

## 14. Motion

- Motion communicates state change, not decoration.
- Standard UI transitions: 120–180 ms.
- Panel open/close: up to 220 ms.
- Timeline dragging and playhead movement: no easing.
- Respect reduced-motion preference.
- Export, proxy, and AI jobs do not use looping decorative animation that distracts during long work.

## 15. Accessibility

Minimum requirements:

- Keyboard reachability for all commands
- Visible focus
- Semantic labels
- Screen-reader names for icon buttons
- No colour-only state
- Text contrast appropriate for dark UI
- Adjustable interface scale
- Captions panel usable without precision dragging
- Menus available as an alternative to right-click
- Touch-accessible hit areas on DeX
- Error messages connected to fields
- Timeline selection and playhead time exposed to accessibility APIs where feasible

Accessibility checks are required by Interface Gate A.

## 16. Responsive behaviour

The editor is not a mobile responsive website. It has desktop-class breakpoints:

| Breakpoint | Behaviour |
|---|---|
| ≥ 1600 px | Left panel, viewer, inspector all persistent |
| 1440–1599 px | Standard three-column layout |
| 1280–1439 px | One persistent side panel; inspector may overlay |
| < 1280 px | Unsupported Phase 1 editing layout |

## 17. Component inventory

Core components include:

- App bar
- Navigation rail
- Resizable panel
- Viewer
- Transport controls
- Timecode field
- Timeline ruler
- Track header
- Timeline clip
- Transition object
- Marker/event
- Inspector section
- Property field
- Media card/row
- Job row
- Proposal card
- Scorebug preview
- Event button
- Connector card
- Export preset card
- Empty/error/recovery state
- Confirmation dialog
- Toast and persistent notification

Components should be implemented in the shared design-system package.

## 18. Visual regression surfaces

At minimum, capture:

- Project Hub
- New Project
- Basketball Game Setup
- Import inspection
- Standard editor layout
- Minimum DeX editor layout
- Multicam viewer
- Basketball logger
- AI proposal panel
- Export Centre
- Recovery dialog
- Relink screen
- Brand Kit Manager

## 19. Brand evolution rule

When a permanent brand is chosen:

- Change semantic tokens, not component-specific values.
- Preserve timeline state colours and accessibility.
- Do not change interaction patterns solely for branding.
- Record the decision in `memory/decisions.md`.
