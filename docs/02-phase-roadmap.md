# Phase Roadmap

> **Status:** Authoritative  
> **Authority:** Milestone scope, order, dependencies, and exit criteria  
> **Version:** 1.0  
> **Last updated:** 2026-07-22

## 1. Delivery model

Phase 1 is delivered through technical and product milestones. A milestone is complete only when its exit criteria and quality gates pass.

Research may begin ahead of a dependency, but production implementation must not bypass foundational contracts.

## 2. Dependency order

```text
M0 Governance and contracts
  ↓
M1 Technical vertical slice
  ↓
M2 Project system and editor shell
  ↓
M3 Timeline kernel
  ↓
M4 Media ingest and asset management
  ↓
M5 Canvas, text, and graphics
  ↓
M6 Audio, transcription, and captions
  ↓
M7 Multicam editing
  ↓
M8 Basketball workflow
  ↓
M9 Broadcast graphics and replays
  ↓
M10 AI proposals and social sequences
  ↓
M11 Brand kits, templates, and connectors
  ↓
M12 Export matrix and hardware acceleration
  ↓
M13 Long-form hardening
```

## 3. Milestone status

| Milestone | Status | Notes |
|---|---|---|
| M0 — Governance and contracts | Complete | Documentation baseline created |
| M1 — Technical vertical slice | Next | Implementation not started |
| M2–M13 | Not started | Blocked by prior dependencies |

The live status is maintained in [`memory/active-state.md`](memory/active-state.md).

## 4. M0 — Governance and contracts

### Goal

Create the authoritative operating and product contracts before implementation.

### Deliverables

- `AGENTS.md`
- `CLAUDE.md`
- Project brief
- Product specification
- Phase roadmap
- Sports workflow
- Design system
- Technical architecture
- Media, timeline, project, AI, connector, and basketball domain contracts
- Repository structure
- Engineering standards
- Testing strategy
- Quality gates
- Security operations
- Git and release rules
- Decision log
- Active state
- Known issues

### Exit criteria

- Every major subject has one authoritative file.
- Scope and exclusions are explicit.
- Agent approval boundaries are explicit.
- Timeline and project formats are versioned in their contracts.
- The scope-expansion process is documented.
- All internal document links resolve.

## 5. M1 — Technical vertical slice

### Goal

Prove the highest-risk local media path before building the full editor.

### Deliverables

- Windows Tauri shell
- React and TypeScript UI
- Rust desktop bridge
- Native FFprobe inspection
- Import one certified MP4
- Generate one proxy
- Preview the proxy
- Place one clip on a minimal timeline
- Trim the clip
- Export MP4 H.264/AAC
- Validate streams, duration, frame rate, and resolution

### Required spike

Benchmark Rust orchestration against simpler alternatives for:

- Process management
- IPC overhead
- Job cancellation
- Metadata throughput
- Crash isolation
- Packaging complexity

Rust remains the selected desktop-native layer unless the spike demonstrates a material maintenance penalty without measurable quality, safety, or performance benefit.

### Exit criteria

A ten-minute H.264/AAC MP4 can be imported, proxied, previewed, trimmed, exported, and validated without corruption or material A/V drift.

### Gate

Media Engine Gate C.

## 6. M2 — Project system and editor shell

### Deliverables

- Project Hub
- New Project
- Local folder layout
- Versioned manifest
- SQLite index
- Project open/close
- Manual save
- Autosave and recovery
- Duplicate and delete
- Missing-media detection
- Relinking
- Editor shell
- Resizable/collapsible panels
- Minimum DeX viewport behaviour

### Exit criteria

A project can be created, saved, closed, reopened, recovered, duplicated, and relinked without losing timeline state.

### Gate

Timeline/Persistence Gate B plus interface checks.

## 7. M3 — Timeline kernel

### Deliverables

- Canonical tick-based time model
- Sequences and tracks
- Video, audio, text, caption, graphic, marker, and nested-sequence objects
- Playhead
- Zoom and scrolling
- Selection
- Move, split, standard trim, ripple trim
- Standard and ripple delete
- Insert and overwrite
- Snapping
- Linked video/audio
- Track lock, mute, solo, and visibility
- Undo/redo command history
- Timeline markers
- Nested sequences
- Save/reopen

### Exit criteria

A multi-track edit survives save/reopen and every required operation has deterministic undo/redo.

### Gate

Timeline/Persistence Gate B.

## 8. M4 — Media ingest and asset management

### Deliverables

- Multi-file and folder import
- Certified, conditional, and best-effort detection
- Proxy queue and profiles
- Thumbnails
- Waveforms
- Camera/audio assignment
- Media tags, search, and filters
- Managed conversion
- Consolidation
- Cache cleanup
- Unused-media review
- Project packaging

### Exit criteria

A 120-minute 2K asset can be inspected, ingested, proxied, reopened, and relinked without losing the original reference.

### Gate

Media Engine Gate C.

## 9. M5 — Canvas, text, and graphics

### Deliverables

- Position, scale, rotation, crop, opacity, anchor, fit/fill, and flip
- Viewer direct manipulation
- Property inspector
- Keyframes and interpolation presets
- Text and font import
- Images, shapes, logos, lower thirds, sponsor graphics
- Progress bars and waveform visualisers
- Separate transition objects
- User template saving

### Exit criteria

A complete branded title, lower-third, and overlay sequence can be created non-destructively and survives save/reopen.

### Gate

Interface Gate A plus Timeline Gate B.

## 10. M6 — Audio, transcription, and captions

### Deliverables

- Multi-track mixer
- Waveforms, volume, pan, mute, solo, and fades
- Commentary/crowd/music mixes
- Cloud transcription
- Speaker separation and renaming
- Transcript correction and search
- Transcript-driven selection and manual deletion
- Caption generation and styling
- SRT/VTT import/export
- English-source caption translation
- Editable translation proposal
- Caption burn-in path

### Exit criteria

A 60-minute programme can be transcribed, corrected, captioned, mixed, reopened, and exported with synchronised audio and captions.

### Gate

AI Gate D plus Media Gate C.

## 11. M7 — Multicam editing

### Deliverables

- Up to four camera groups
- Audio-waveform sync
- Timecode sync
- Manual marker and offset sync
- Angle lock
- Multicam viewer
- Live switching with keys 1–4
- Editable switch points
- Active-angle replacement
- Multicam audio selection
- Source-angle navigation

### Exit criteria

A four-camera fixture can be synchronised, switched live, refined, saved, reopened, and exported without angle or timing drift.

### Gate

Timeline Gate B plus Media Gate C.

## 12. M8 — Basketball workflow

### Deliverables

- Basketball Game Setup
- Teams, logos, colours, and rules
- Optional roster
- Manual/CSV/JSON roster import
- Event logger
- Scoring events and automatic score calculation
- Foul, timeout, substitution, period, and custom events
- Score corrections
- Basic player points and team fouls
- Game-clock anchors
- Event filters and marker conversion

### Exit criteria

A full basketball period can be logged and corrected while maintaining an accurate score, clock mapping, and basic event history.

### Gate

Basketball domain integration plus Timeline Gate B.

## 13. M9 — Broadcast graphics and replays

### Deliverables

- Scorebug view model and templates
- Team names, logos, colours, score, period, game clock
- Possession, fouls, timeouts, bonus, optional shot clock
- Sponsor placement
- Player lower thirds
- Replay selection and nested replay creation
- Fixed rates: 0.25×, 0.5×, 1×, 2×
- Replay bumper and audio modes

### Exit criteria

A basketball sequence can become a basic broadcast with accurate graphics and editable, non-destructive replays.

### Gate

Timeline Gate B plus Media Gate C.

## 14. M10 — AI proposals and social sequences

### Deliverables

- AI Assistant
- Natural-language commands
- Project, sequence, selection, range, period, team, player, and event scopes
- Highlight scoring
- Evidence and confidence display
- Proposal preview, accept, reject, and modify
- Separate proposal sequences
- 16:9, 9:16, 1:1, and 4:5 social sequences
- Source traceability
- Undo after acceptance
- Master-mutation protection

### Exit criteria

The system produces several explainable, editable clip proposals without modifying the approved master.

### Gate

AI Gate D.

## 15. M11 — Brand kits, templates, and connectors

### Deliverables

- Brand Kit Manager
- Template Library
- Google Drive
- Dropbox
- OneDrive
- Direct URL
- YouTube project integration
- Connection recovery
- Download progress and cancellation
- Localisation of remote assets
- Connector error handling

### Exit criteria

Remote assets can be selected, inspected, downloaded locally, and used without a permanent remote dependency.

### Gate

Connector integration tests plus Security checks.

## 16. M12 — Export matrix and hardware acceleration

### Windows deliverables

- H.264/AAC and H.265/AAC MP4
- 720p, 1080p, 1440p, and 4K
- Hardware decode/encode
- Software fallback
- Test-range export
- Caption burn-in and sidecars
- Export validation

### DeX deliverables

- 720p and 1080p
- Supported hardware encode
- Compatibility fallback
- DeX-compatible proxy workflow

### Exit criteria

Every promised platform/codec/resolution combination passes the certification matrix.

### Gate

Media Gate C and release certification.

## 17. M13 — Long-form hardening

### Reference project

- 120 minutes
- 2K sources
- Four cameras
- Commentary, crowd, and music
- Scorebug, lower thirds, sponsor graphics
- Complete captions
- Multiple replays
- Long-form and social outputs

### Hardening areas

- Timeline responsiveness
- Memory stability
- Autosave and recovery
- Proxy/original relink
- Export cancellation and cleanup
- Cache management
- Missing-media recovery
- AI proposal isolation
- Score and clock persistence
- A/V synchronisation
- Frame accuracy
- Packaging
- DeX minimum layout

### Exit criteria

The reference project completes end to end without corruption, permanent drift, missing output, incorrect score/clock state, or unrecoverable editing state.

## 18. Scope expansion policy

Before adding work outside the current milestone or Phase 1 scope, provide:

```text
Proposed expansion
Reason it appears necessary
User value
Technical impact
Architecture impact
Testing impact
Alternative that stays within scope
Recommendation
```

Implementation requires explicit acceptance.

## 19. Milestone change policy

A milestone may be split when:

- Its risk cannot be isolated through existing gates.
- The deliverable is too broad for a coherent acceptance test.
- A platform spike changes dependency order.
- The user accepts the revised plan.

A milestone may not be marked complete by deferring failed exit criteria to a later milestone.

## 20. Phase 1 release candidate

A Phase 1 release candidate requires:

- M0–M13 complete
- No unresolved release blocker
- Reference project certification
- Windows export matrix certification
- DeX 720p/1080p certification
- Recovery drill
- Project packaging drill
- Security checklist
- Known-issues review
- Explicit user approval to create the release
