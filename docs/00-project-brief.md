# Project Brief

> **Status:** Authoritative  
> **Authority:** Vision, user, outcomes, and constraints  
> **Version:** 1.0  
> **Last updated:** 2026-07-22

## 1. Working title

**Sports-Aware AI Video Editor**

A permanent product name has not been selected. Code, schemas, and user-facing strings should avoid embedding a temporary brand name.

## 2. Vision

Create a local-first video editor that gives one creator the editing and broadcast workflow normally associated with a small production team.

The editor must be broadly useful for general video, podcast, and marketing work, while becoming materially more capable when editing basketball footage.

## 3. Product promise

> **Edit the full game, build the broadcast, and generate every highlight from one timeline.**

## 4. Primary user

The initial user is a solo general content creator who regularly edits sports and broadcast-style footage.

The user:

- Works without a production team.
- Imports existing camera, audio, image, and graphic assets.
- Edits long sessions of 60–120 minutes.
- Needs a complete YouTube-ready programme.
- Also needs multiple social-ready clips from the completed work.
- Values quality and control over maximum export speed.
- Uses Windows as the initial desktop platform.
- May use a Samsung S-series tablet in DeX mode as the minimum supported editing environment.
- Does not require accounts, team roles, or enterprise administration in Phase 1.

## 5. Problems to solve

### 5.1 General editing friction

Broad browser editors can be approachable but often become cumbersome for long-form, multicamera, and timeline-intensive work.

### 5.2 Sports workflow fragmentation

A solo sports creator may need separate tools for:

- Camera synchronisation
- Timeline editing
- Score and clock logging
- Broadcast graphics
- Replay creation
- Transcription
- Captions
- Highlight selection
- Social reframing
- Export

The product should connect these workflows through one project and one timeline domain.

### 5.3 AI trust

AI-generated cuts are difficult to trust when they are opaque or modify the master edit directly. The product must expose evidence, confidence, source ranges, and reversible approval.

### 5.4 Long-form reliability

A two-hour multicamera project is only useful when autosave, relinking, proxies, export validation, and recovery are dependable.

## 6. Jobs to be done

### Primary job

> When I have up to four cameras and multiple audio sources from a basketball game, help me turn them into a finished broadcast and several social clips without requiring a team or surrendering control to AI.

### Secondary jobs

- Edit a podcast through both transcript and timeline.
- Create branded marketing videos with text, images, captions, and reusable templates.
- Edit general long-form video with multiple tracks and non-destructive effects.
- Reuse one approved master to create several aspect-ratio-specific outputs.

## 7. Product category

The selected category is:

**Sports-aware general editor**

The editor is not restricted to basketball, but basketball receives the first sport-specific domain, event system, scorebug, clock, statistics, multicam, and replay workflows.

## 8. Phase 1 objective

Deliver an internal working prototype that proves the product can:

1. Ingest and proxy long-form media.
2. Support a reliable multi-track editing workflow.
3. Synchronise and edit up to four cameras.
4. Log basketball events and drive broadcast graphics.
5. Transcribe and caption a long-form project.
6. Produce non-destructive replay sequences.
7. Generate explainable AI clip proposals.
8. Export a verified long-form master and social variants locally.
9. Run on Windows and provide a practical DeX editing experience with reduced export limits.
10. Preserve project state through closing, reopening, missing media, and recovery.

## 9. Phase 1 success outcomes

The prototype is successful when one user can complete the reference workflow without project corruption or manual reconstruction:

```text
Create basketball project
→ Import up to four cameras and multiple audio sources
→ Generate proxies
→ Synchronise cameras
→ Build multicam edit
→ Log game events and clock anchors
→ Add scorebug, graphics, captions, and replays
→ Export a YouTube-ready master
→ Generate and review AI social proposals
→ Export approved clips in multiple aspect ratios
```

## 10. Reference workload

The long-form certification project is:

| Property | Target |
|---|---|
| Duration | 120 minutes |
| Source resolution | At least 2K |
| Cameras | Four |
| Audio | Commentary, crowd/venue, and music |
| Graphics | Scorebug, lower thirds, sponsor graphics |
| Captions | Complete English captions |
| Replays | Multiple nested replay objects |
| Outputs | Long-form master and several social clips |

## 11. Product principles

### Timeline first

The timeline is the primary editing surface. Transcript, AI, canvas, basketball events, and multicam operations all modify or reference the same underlying domain.

### Local-first media ownership

Source media, proxies, project data, caches, and exports remain local. Cloud services are used only for selected AI and connector workflows.

### Non-destructive by default

Source assets remain unchanged. Edits, transforms, keyframes, effects, score events, and replays are project instructions.

### AI proposes; the user decides

AI may analyse and create separate proposal sequences. It may not silently modify the approved master, official score, or official game clock.

### Quality over export speed

Hardware acceleration should be used when suitable, but a high-quality software path must remain available. Output must be validated before success is reported.

### Sports-aware, not sports-exclusive

General, podcast, and marketing workflows remain first-class. Basketball capability is an extension of the same editor rather than a separate application.

## 12. Platform constraints

### Windows

- Initial desktop release target.
- Full Phase 1 editing.
- Local H.264 and H.265 export.
- 720p, 1080p, 1440p, and 4K output.
- Hardware acceleration when available.
- High-quality CPU fallback.

### Samsung DeX

- Minimum logical viewport: `1280 × 800`.
- Full editing workflow is targeted.
- Export limited to 720p and 1080p.
- Keyboard and mouse are primary.
- Touch supports selection, scrolling, dragging, and basic trimming.
- Unsupported originals may rely on compatible proxies prepared by desktop.

### Excluded platforms

macOS, Linux, mobile-phone layouts, and browser-only delivery are outside Phase 1.

## 13. Core technical constraints

- Local project files and local final rendering.
- No forced watermark on prototype exports.
- Versioned project and timeline schemas.
- Platform-neutral timeline domain.
- Native FFmpeg-based desktop media engine.
- Android/DeX native media adapter.
- React and TypeScript shared interface.
- Rust limited to the desktop shell and performance-sensitive native orchestration, subject to vertical-slice validation.
- Kotlin for Android/DeX integration.
- Provider-neutral AI and connector boundaries.
- No cloud backend is required for basic project ownership.

## 14. Commercial and organisational assumptions

- Phase 1 is an internal prototype.
- No subscription, billing, roles, workspace, collaboration, or account system is required.
- Projects belong to one local user.
- Enterprise-grade controls are not required.
- Baseline privacy, token protection, media validation, and safe local processing are still mandatory.

## 15. Explicit non-goals

Phase 1 does not include:

- Live streaming or live broadcast production
- Collaborative editing
- Public review links
- Cloud project storage
- Screen, webcam, or microphone recording
- Stock media
- Full basketball box scores
- Visual event recognition
- Automatic scoreboard reading
- Player or ball tracking
- Jersey recognition
- AI avatars or text-to-video
- Generative video replacement
- Full audio restoration
- Speed ramps or optical-flow slow motion
- Advanced colour grading
- Motion tracking or mask tracking
- Advanced keyframe graph editing
- Transparent-background video export
- Cloud rendering
- Background export after the application closes
- Unofficial YouTube downloading

The complete normative exclusion list is maintained in [`01-product.md`](01-product.md).

## 16. Prototype evaluation questions

At the end of Phase 1, evaluate:

1. Can the reference project be completed end to end?
2. Is timeline interaction responsive enough for long-form work?
3. Is multicam synchronisation and refinement dependable?
4. Can score, clock, and event history be corrected without inconsistency?
5. Do AI proposals save time while remaining understandable and reversible?
6. Are local storage, relinking, and recovery practical?
7. Is DeX useful for real editing rather than only review?
8. Does the product feel distinct from a generic browser editor?
9. Which capabilities are strong enough for future external testing?
10. Which architecture assumptions failed under the reference workload?

## 17. Glossary

| Term | Meaning |
|---|---|
| Approved master | The user-controlled long-form sequence used as the authoritative edit |
| Asset | Imported video, audio, image, font, graphic, or remote-downloaded file |
| Certified format | A media combination covered by the formal import and export test matrix |
| Best-effort format | A format the desktop engine attempts to decode without a full compatibility guarantee |
| Clock anchor | A mapping between timeline time and basketball game time |
| Event | A basketball occurrence such as a made shot, foul, timeout, or period boundary |
| Nested sequence | A reusable sequence placed as an object inside another sequence |
| Proposal sequence | A separate AI-created sequence that does not modify the approved master |
| Proxy | A lower-complexity local derivative used for responsive editing |
| Replay object | A specialised nested sequence referencing an original source range |
| Social sequence | An independent aspect-ratio-specific sequence derived from the master or source |
| Timeline tick | The authoritative integer time unit used by the timeline domain |

## 18. Related authoritative documents

- Product capabilities: [`01-product.md`](01-product.md)
- Milestones: [`02-phase-roadmap.md`](02-phase-roadmap.md)
- Sports workflow: [`03-sports-workflows.md`](03-sports-workflows.md)
- Architecture: [`architecture/technical-architecture.md`](architecture/technical-architecture.md)
- Accepted decisions: [`memory/decisions.md`](memory/decisions.md)
