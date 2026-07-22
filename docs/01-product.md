# Phase 1 Product Specification

> **Status:** Authoritative  
> **Authority:** Phase 1 capabilities, screens, user-visible behaviour, and exclusions  
> **Version:** 1.0  
> **Last updated:** 2026-07-22

## 1. Product definition

The product is a dark, desktop-class, local-first video editor for one creator. It combines general editing, podcast and marketing workflows with basketball-aware multicamera, event, score, clock, replay, and highlight workflows.

The editor is timeline-first. AI, transcript, canvas, multicam, and basketball tools operate against the same project and sequence domain.

## 2. Product promise

> **Edit the full game, build the broadcast, and generate every highlight from one timeline.**

## 3. Phase 1 experience principles

1. **Timeline first.** Timeline state is visible and directly editable.
2. **Non-destructive by default.** Originals are never modified.
3. **AI proposes; the user decides.** Master changes require user action.
4. **Local media ownership.** Media and final exports remain on device.
5. **Long-form reliability.** Autosave, recovery, proxies, relinking, and export validation are release-critical.
6. **Sports-aware rather than sports-exclusive.** General editing remains first-class.
7. **Quality before speed.** Fast paths may not silently reduce output quality.
8. **Explainable state.** Background jobs, AI confidence, media compatibility, and export status must be visible.

## 4. Supported environment

### 4.1 Windows

- Initial desktop target.
- Full feature set.
- H.264 and H.265 MP4 export.
- 720p, 1080p, 1440p, and 4K.
- Hardware acceleration when suitable.
- High-quality CPU fallback.

### 4.2 Samsung DeX

- Minimum logical viewport: `1280 × 800`.
- Full editing target.
- 720p and 1080p local export.
- Keyboard and mouse primary; touch supports essential direct manipulation.
- No hover-only feature.
- One expanded side panel at minimum width.
- Timeline retains at least 260 logical pixels of height.

## 5. Primary workflows

### WF-01 — Basketball broadcast

```text
Create game
→ Import and assign cameras/audio
→ Generate proxies
→ Synchronise cameras
→ Build multicam edit
→ Log events and clock anchors
→ Add scorebug and graphics
→ Create replays
→ Transcribe and caption
→ Mix audio
→ Export full programme
```

### WF-02 — Basketball social package

```text
Open approved master
→ Run scoped AI highlight analysis
→ Review evidence and confidence
→ Accept or modify proposal sequences
→ Reframe per aspect ratio
→ Export approved batch
```

### WF-03 — Podcast edit

```text
Import video/audio
→ Transcribe and identify speakers
→ Edit through transcript and timeline
→ Add captions, branding, and waveform graphics
→ Export long-form and social variants
```

### WF-04 — Marketing or general edit

```text
Import assets
→ Build multi-track edit
→ Add text, images, graphics, keyframes, and transitions
→ Apply brand kit/template
→ Export one or more formats
```

## 6. Screen inventory

### S-01 — Project Hub

Required capabilities:

- Recent, pinned, basketball, and general projects
- Project thumbnail, duration, resolution, location, and last opened time
- Create, open, rename, duplicate, pin, remove from recent, and delete
- Import or create a portable project
- Open project folder
- Missing-media warning
- Recovery warning
- Relink action
- First-use, unavailable-storage, corrupt-project, and unsupported-version states

### S-02 — New Project

Project presets:

- General video
- Basketball game
- Podcast
- Marketing video
- Social-first video
- Empty custom sequence

Settings:

- Name and location
- Sequence aspect ratio and resolution
- Frame rate
- Audio sample rate
- Proxy policy
- Default caption language
- Brand kit and template
- Hardware acceleration preference

Defaults:

- Basketball: 1080p at 59.94 fps when no primary source is selected
- General: 1080p at 30 fps when no primary source is selected
- Prefer primary camera frame rate when known

### S-03 — Basketball Game Setup

- Home and away teams
- Abbreviations, colours, and logos
- Date, venue, competition, title, sponsor, and notes
- Period count and duration
- Overtime duration
- Shot-clock availability
- Team-foul, bonus, and timeout configuration
- Optional roster with name, number, position, image, team, and active state
- Manual, CSV, and JSON roster entry
- Field mapping and validation before import

### S-04 — Import and Ingest

Sources:

- Local file
- Local folder
- Google Drive
- Dropbox
- OneDrive
- Direct media URL
- YouTube project integration

Inspection:

- File name, size, type, codec, duration, resolution, frame rate, and audio streams
- Certified, conditional, or best-effort compatibility status
- Proxy estimate and available disk space
- Actionable compatibility warnings

Assignments:

- Camera A–D
- Commentary
- Crowd/venue
- Music
- Sound effects
- Graphics
- Photos
- Unassigned

Actions:

- Link original
- Copy into project
- Generate or defer proxy
- Cancel or retry
- Convert to a managed compatible asset
- Consolidate selected media

### S-05 — Editor Workspace

Layout:

```text
Application bar
Left navigation and tool panel
Central viewer
Right property inspector
Timeline controls
Multi-track timeline
```

Application bar:

- Project name and save state
- Undo and redo
- Active sequence
- Proxy/original indicator
- Performance indicator
- Project settings
- Export

Viewer modes:

- Program
- Source
- Multicam
- Comparison
- Full screen

Viewer controls:

- Play, pause, stop
- Frame step
- Previous/next edit
- Mark in/out
- Safe areas and grid
- Canvas snapping
- Preview quality
- Current timecode
- Basketball game clock where available

Left navigation:

1. Media
2. Transcript
3. Captions
4. Text
5. Graphics
6. Basketball
7. Multicam
8. Audio
9. Templates
10. Brand
11. AI Assistant
12. Export

### S-06 — Brand Kit Manager

A brand kit contains:

- Primary, secondary, and monochrome logos
- Colour palette
- Fonts
- Caption styles
- Lower thirds
- Scorebug designs
- Intro and outro sequences
- Sponsor graphics

Actions:

- Create, duplicate, import, export, and set default
- Apply kit or individual asset
- Replace a brand asset across the project
- Import custom fonts

### S-07 — Template Library

Template types:

- Project
- Sequence
- Caption
- Text animation
- Lower third
- Scorebug
- Replay bumper
- Intro/outro
- Sponsor card
- Social layout
- Podcast layout

Sources:

- Built-in
- User-created
- Brand kit

Stock media is excluded.

### S-08 — Connector Manager

States:

- Not connected
- Connecting
- Connected
- Expired
- Access denied
- Downloading
- Quota limited
- Error

Actions:

- Connect/disconnect
- Refresh
- Browse/search
- Inspect/select
- Download to project
- Cancel/retry

Remote media must be local before editing.

### S-09 — Export Centre

Targets:

- Full project
- Active sequence
- Selected range
- One social proposal
- Batch of approved social proposals
- Audio only
- Caption file

Video outputs:

- Windows: MP4 H.264/AAC and MP4 H.265/AAC
- Windows: 720p, 1080p, 1440p, and 4K
- DeX: certified device-supported MP4 path at 720p and 1080p
- No forced watermark or product branding

Controls:

- Resolution, frame rate, codec, quality, hardware/software path
- Audio bitrate and mix
- Destination and filename
- Burned-in captions
- Separate SRT/VTT output
- Test-range export
- Existing-file confirmation

States:

- Queued
- Analysing
- Rendering
- Encoding
- Validating
- Completed
- Completed with warning
- Cancelled
- Failed

Success requires output validation, not only process completion.

### S-10 — Preferences

Groups:

- General
- Editing
- Media
- AI
- Integrations

Required settings include project folder, autosave, UI scaling, shortcuts, snapping, proxy profiles, cache, hardware decode/encode, AI provider and consent, confidence display, and connector status.

### S-11 — Recovery and Relinking

Recovery:

- Recover latest autosave
- Compare with manual save
- Open recovery as copy
- Discard
- Review operation history

Relinking:

- Search original or selected folders
- Match by path, name, size, metadata, or checksum
- Replace one or all
- Use proxy temporarily
- Mark intentionally offline

### S-12 — Project Packaging

Package options:

- Project data only
- Project plus used originals
- Project, originals, and proxies
- Project with DeX-compatible proxies
- Project, media, fonts, and brand assets

Report included, excluded, missing, and connector-only files before packaging.

## 7. Editor panels

### P-01 — Media Bin

- Folders, collections, tags, search, and sort
- Camera, proxy, missing, used, and media-type filters
- List and thumbnail views
- Source preview
- Insert, overwrite, append, and overlay actions

### P-02 — Transcript

- Speaker-separated, timed transcript
- Search, speaker rename, correction, and regeneration of a selected segment
- Jump to timeline
- Select source range
- Create clip, marker, captions, or translation
- Manual range removal with undo
- AI-suggested removal as proposal only

### P-03 — Captions

- Caption tracks and segment list
- Timing, line breaks, position, typography, background, outline, shadow, and animation
- Safe-area placement
- Translation
- SRT/VTT import and export

### P-04 — Text and Graphics

- Headings and standard text
- Lower thirds
- Shapes
- Progress bars
- Waveform visualisers
- Images, logos, and sponsor graphics
- Animation presets and saved presets

### P-05 — Basketball Event Logger

- Current period, game clock, score, team, and player
- Event buttons
- Custom marker
- Recent events and correction history
- Search/filter/jump
- Convert event to clip
- Suggest replay
- Include/exclude from statistics

### P-06 — Multicam

- Camera A–D previews
- Sync and lock status
- Audio source
- Live switching
- Switch history and refinement
- Replace angle
- Open source
- Resynchronise
- Flatten with explicit confirmation

### P-07 — AI Assistant

Supported commands include:

- Transcribe
- Create or translate captions
- Find scoring plays or three-point plays
- Find crowd or commentary moments
- Create game recap
- Create player, team, period, or social highlights
- Find long pauses
- Suggest camera changes
- Suggest replay ranges
- Explain a proposal

Scopes:

- Project
- Active sequence
- Selected clips
- In/out range
- Basketball period
- Team
- Player
- Event type

Every proposal shows action, scope, source range, confidence, evidence, duration, and preview, with accept, reject, modify, duplicate, and compare actions.

### P-08 — Audio and Mixer

- Volume, mute, solo, pan, fades, and waveform
- Linked/detached audio
- Commentary, crowd, music, and master mix
- Peak warning

Advanced restoration is excluded.

### P-09 — Property Inspector

Contextual support for video, audio, image, text, caption, graphic, transition, nested sequence, replay, marker, event, scorebug, track, and sequence.

### P-10 — Marker and Event List

- Sequence and clip markers
- Basketball events
- AI suggestions
- Notes
- Categories and colour
- Search/filter/jump
- Create sequence from selected markers

## 8. Core editing capabilities

### Project and media

- Create, rename, duplicate, package, recover, and delete projects
- Import video, audio, images, graphics, and fonts
- Link or copy originals
- Generate and select proxies
- Relink missing media
- Clear generated cache
- Remove unused media with explicit review

### Timeline

- Multiple simultaneous video and audio tracks
- Text, caption, graphic, marker, and event lanes
- Move, reorder, duplicate, trim, split, delete, and ripple delete
- Insert and overwrite modes
- Snapping
- Track lock, visibility, mute, and solo
- Linked video/audio with detach and relink
- Nested sequences
- Multicam sequences
- Replay objects
- Undo and redo
- Zoom and scroll
- Configurable shortcuts

### Canvas

- Position
- Scale
- Rotation
- Crop
- Opacity
- Anchor
- Horizontal and vertical flip
- Fit/fill/reset
- Keyframes for transform, opacity, supported text values, and audio volume
- Linear, ease-in, ease-out, ease-in-out, and hold interpolation

### Playback and preview

- Play, pause, stop, seek, frame step
- Previous/next edit
- Program/source/multicam/comparison modes
- Preview quality selection
- Proxy or original preview
- Safe areas and grid

### Speed

Fixed clip/replay rates:

- 0.25×
- 0.5×
- 1×
- 2×

Speed ramps and optical flow are excluded.

### Transitions

Separate timeline objects:

- Cut
- Cross dissolve
- Fade to colour
- Dip to black
- Audio crossfade
- Replay bumper

### Audio

- Multiple tracks
- Waveforms
- Volume, pan, mute, solo, fades
- Commentary/crowd/music mix
- Linked and detached source audio

### Transcript and captions

- English transcription
- Multiple-speaker identification
- Timed editing and search
- Transcript-driven navigation and range selection
- Caption generation and styling
- English-source caption translation through a connected provider
- SRT/VTT import/export
- Burn-in or sidecar output

## 9. Basketball capabilities

Phase 1 includes:

- Optional roster
- Up to four cameras
- Audio/manual/timecode synchronisation
- Live camera switching with keys 1–4
- Made basket, missed shot, rebound, assist, steal, block, turnover, foul, timeout, substitution, period, replay, crowd, commentary, and custom events
- Scoring events automatically updating score
- Explicit score correction records
- Game-clock anchors per period
- Basic points, team fouls, and major event history
- Editable scorebug
- Team logos, names, colours, score, period, clock, possession, fouls, timeouts, bonus, optional shot clock, and sponsor placement
- Nested replay creation
- CSV and JSON roster/event import where defined

The basketball data rules are authoritative in [`architecture/basketball-domain.md`](architecture/basketball-domain.md).

## 10. AI capabilities and restrictions

### Automatic analysis

AI may generate without changing the master:

- Transcript
- Speaker labels
- Captions
- Caption translation
- Silence labels
- Commentary-intensity signals
- Crowd-volume signals
- Candidate event markers
- Candidate highlight scores
- Titles and descriptions

### Proposal creation

AI may create:

- Draft markers
- Draft captions
- Separate proposal sequences
- Suggested clip boundaries
- Suggested camera switches
- Suggested replay ranges
- Suggested reframe paths

### Approval required

AI may not directly:

- Change the approved master
- Change an official score
- Change the official game clock
- Apply a camera switch
- Insert a replay
- Replace approved captions
- Delete media
- Ripple-delete timeline ranges
- Overwrite an export
- Change a brand kit

Full visual basketball-event recognition is excluded.

## 11. External integrations

Phase 1 connectors:

- Google Drive
- Dropbox
- OneDrive
- Direct media URL
- YouTube project integration

YouTube integration may handle project metadata and authorised user workflows. It must not implement an unofficial source-video downloader.

## 12. Keyboard baseline

| Action | Default |
|---|---|
| Play/pause | Space |
| Split | Ctrl+B |
| Undo | Ctrl+Z |
| Redo | Ctrl+Shift+Z |
| Save | Ctrl+S |
| Delete | Delete |
| Ripple delete | Shift+Delete |
| Select all | Ctrl+A |
| Duplicate | Ctrl+D |
| Timeline zoom in | Ctrl+= |
| Timeline zoom out | Ctrl+- |
| Fit timeline | Shift+Z |
| Mark in/out | I / O |
| Previous/next frame | Left / Right |
| Previous/next edit | Up / Down |
| Camera A–D | 1 / 2 / 3 / 4 |
| Toggle snapping | N |
| Full-screen viewer | Ctrl+Shift+F |

Phase 1 requires one editable shortcut profile.

## 13. Reliability requirements

A release is blocked by:

- Project data loss
- Timeline corruption
- Save/reopen changing the edit
- Persistent A/V drift
- Missing clips in export
- Proxy-to-original replacement failure
- False successful export state
- AI mutation of the approved master
- Undo failure after AI acceptance
- Incorrect score or clock persistence caused by project reload
- Unrecoverable autosave state

## 14. Phase 1 definition of done

The user can:

1. Create a basketball project without an account.
2. Import four camera sources and multiple audio sources.
3. Generate and use proxies.
4. Synchronise and edit multicam footage.
5. Log scores, events, and clock anchors.
6. Add scorebug, broadcast graphics, and slow-motion replay objects.
7. Transcribe, correct, translate, style, and export captions.
8. Edit through timeline and transcript.
9. Use keyframes for core properties.
10. Create reusable brand and template assets.
11. Export a verified long-form master.
12. Generate explainable AI social proposals.
13. Accept or reject proposals without affecting the master.
14. Export approved clips in 16:9, 9:16, 1:1, and 4:5.
15. Save, close, reopen, relink, recover, and package the project.

## 15. Explicit Phase 1 exclusions

The following require the scope-expansion process:

- Accounts, billing, workspaces, and roles
- Real-time collaboration
- Public review links
- Cloud project storage
- Live streaming or live switching
- Screen, camera, or microphone recording
- Stock media
- Full basketball box score
- Automatic scoreboard recognition
- Visual made-shot detection
- Player, ball, or mask tracking
- Jersey-number recognition
- AI avatars
- Text-to-video
- Generative video replacement
- Advanced background removal
- Full audio restoration
- Speed ramps
- Optical-flow slow motion
- Advanced colour grading and LUT management
- Advanced keyframe graph editor
- Transparent video export
- Cloud rendering
- Background export after app exit
- macOS and Linux releases
- Phone-sized editing layout
- Unofficial YouTube downloading

## 16. Requirement traceability

Implementation requirements should use stable prefixes:

| Prefix | Area |
|---|---|
| PRJ | Project system |
| MED | Media ingest and proxy |
| TML | Timeline |
| CVS | Canvas |
| AUD | Audio |
| TXT | Transcript/captions |
| MCM | Multicam |
| BSK | Basketball |
| GFX | Graphics/templates/brand |
| AIP | AI proposals |
| CON | Connectors |
| EXP | Export |
| REC | Recovery/relinking |
| DEX | DeX |
| SEC | Security/privacy |

Tests and implementation plans should reference applicable IDs once detailed requirement IDs are introduced.
