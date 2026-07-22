# Technical Architecture

> **Status:** Authoritative  
> **Authority:** Platform architecture, process boundaries, technology selection, and system data flow  
> **Version:** 1.0  
> **Last updated:** 2026-07-22

## 1. Architectural goals

The architecture must support:

- A responsive timeline-first editor
- Two-hour, four-camera projects
- Local project storage and rendering
- Windows desktop as the primary target
- Samsung DeX editing with 720p/1080p export
- Non-destructive editing
- Platform-neutral timeline and basketball domains
- Swappable AI and connector providers
- Explicit jobs, progress, cancellation, and recovery
- Versioned persistence
- High-quality export with validation
- Incremental development through the roadmap

## 2. Non-goals

Phase 1 architecture does not need:

- A multi-tenant cloud backend
- User accounts, billing, workspaces, or roles
- Cloud project storage
- Real-time collaboration
- Live streaming
- Server-side rendering
- Browser-only media processing
- Background exports after application exit

## 3. Selected technology stack

| Layer | Selection | Responsibility |
|---|---|---|
| Shared UI | React + TypeScript + Vite | Editor screens, panels, timeline presentation, and interaction |
| Shared application state | TypeScript | UI orchestration and platform-neutral use cases |
| Shared domains | TypeScript packages | Timeline, project, AI contracts, basketball, and media contracts |
| Desktop shell | Tauri | Native window, lifecycle, filesystem permissions, and IPC |
| Desktop native layer | Rust | Process/job orchestration, safe filesystem access, FFmpeg bridge, and performance-sensitive coordination |
| Desktop media engine | Native FFmpeg/FFprobe | Inspect, decode, proxy, waveform, thumbnail, render, encode, mux, and validate |
| Android/DeX shell | Tauri mobile | Shared web UI and native bridge |
| Android/DeX native layer | Kotlin | Android lifecycle, filesystem, permissions, and media adapter |
| Android/DeX media engine | Media3/MediaCodec adapter | Supported preview, composition, proxy-compatible playback, and 720p/1080p local export |
| Project manifest | Versioned JSON | Portable authoritative project metadata and domain state |
| Local index | SQLite | Search, job state, derived metadata, and performance indexes |
| AI | Provider-neutral adapters | Cloud transcription, translation, reasoning, and proposal generation |
| Connectors | Provider-neutral adapters | Google Drive, Dropbox, OneDrive, direct URL, and YouTube project integration |

## 4. Conditional Rust decision

Rust is selected for the Windows native layer, not for video quality itself. FFmpeg determines most desktop media processing quality.

Milestone 1 must benchmark Rust orchestration for:

- Process spawning and cancellation
- Structured progress parsing
- Metadata throughput
- IPC overhead
- Crash isolation
- Packaging
- Maintenance cost

Rust remains selected when it provides a material safety, packaging, performance, or reliability benefit. Replacing it requires an accepted architecture decision and evidence from the vertical slice.

Python may be used for AI experiments, offline evaluation, and development scripts. It must not become a required runtime for the core editor without scope approval.

## 5. High-level architecture

```text
┌───────────────────────────────────────────────────────────────┐
│ React application                                             │
│ Screens · Panels · Viewer · Timeline UI · Inspector           │
├───────────────────────────────────────────────────────────────┤
│ Application services                                          │
│ Project · Timeline commands · Jobs · AI · Connectors · Export │
├───────────────────────────────────────────────────────────────┤
│ Platform-neutral domains                                      │
│ Timeline · Project · Basketball · Proposals · Media contracts │
├──────────────────────────────┬────────────────────────────────┤
│ Windows adapter              │ Android/DeX adapter            │
│ Tauri + Rust                  │ Tauri + Kotlin                 │
│ FFmpeg/FFprobe                │ Media3/MediaCodec              │
├──────────────────────────────┴────────────────────────────────┤
│ Local filesystem · SQLite · secure credential storage         │
└───────────────────────────────────────────────────────────────┘
                         │
                         ▼
              Selected cloud AI/connectors
```

## 6. Process boundaries

### 6.1 UI process

Responsibilities:

- Render interface
- Dispatch application commands
- Maintain transient workspace state
- Display job progress and errors
- Never directly execute FFmpeg
- Never hold provider client secrets
- Never treat UI state as authoritative project state

### 6.2 Desktop native process

Responsibilities:

- Validate file paths and permissions
- Inspect media
- Start and cancel FFmpeg/FFprobe jobs
- Parse progress
- Manage temporary files and atomic moves
- Expose structured IPC
- Validate exports
- Protect credential access
- Report native capabilities

### 6.3 Android/DeX native process

Responsibilities:

- Android file access and persisted permissions
- Device codec capability inspection
- Native media preview/export adapter
- Background job lifecycle while the app remains open
- Secure credential storage
- Structured IPC
- DeX device and viewport capability reporting

### 6.4 Cloud services

Cloud services are optional and task-specific:

- Transcription
- Caption translation
- Language reasoning
- Highlight proposal reasoning
- Provider authentication for external media

Full-resolution video should not be uploaded when audio, transcript, thumbnails, selected frames, or metadata are sufficient.

## 7. Domain boundaries

### Timeline domain

Owns:

- Time
- Sequence, track, and object semantics
- Editing commands
- Selection-independent operations
- Undo/redo representation
- Nesting and multicam edit state

Must not depend on:

- React
- Tauri
- FFmpeg
- Media3
- Provider SDKs
- SQLite APIs

### Project domain

Owns:

- Project identity and schema version
- Asset references
- Sequence registry
- Settings
- Brand and template references
- Migration contracts
- Packaging manifest

### Basketball domain

Owns:

- Teams, players, rules
- Events
- Scores
- Clock anchors
- Basic statistics
- Scorebug view model

It may reference timeline ticks through shared contracts but must not import timeline UI or media engine code.

### Media contracts

Owns platform-neutral requests and results:

- Inspect
- Generate proxy
- Generate thumbnail/waveform
- Preview capability
- Render plan
- Export job
- Validation result

### AI domain

Owns:

- Analysis request
- Consent context
- Transcript/caption contracts
- Proposal and evidence
- Acceptance state
- Provider-neutral errors

### Connector domain

Owns:

- Connection state
- Browse/search
- Remote asset metadata
- Download request
- Progress, cancellation, and errors

## 8. Repository architecture

The normative repository tree is defined in [`../engineering/structure.md`](../engineering/structure.md).

Dependency direction:

```text
UI components
  ↓
Application services
  ↓
Domain packages
  ↓
Contracts

Platform adapters implement contracts.
Domains never import platform adapters.
```

Circular package dependencies are prohibited.

## 9. Application state model

State is divided into four categories.

### 9.1 Persistent domain state

Saved in the project:

- Sequences
- Tracks and timeline objects
- Asset references
- Basketball state
- Captions
- Brand/template references
- Approved proposal state
- Project settings

### 9.2 Persistent operational state

Saved locally but not necessarily portable:

- Job history
- Cached metadata
- Connector state references
- Proxy status
- Recent project list
- Recovery checkpoints

### 9.3 Transient workspace state

Not authoritative:

- Open panel
- Scroll position
- Hover
- Current drag
- Temporary selection rectangle
- Menu state
- Preview buffer state

Selected items and playhead may be restored as convenience but must not affect project correctness.

### 9.4 Derived state

Recomputed or indexed:

- Scorebug view model
- Basic statistics
- Sequence duration
- Waveform tiles
- Thumbnail strips
- Search index
- Highlight features
- Export warnings

Derived state must be disposable and reproducible.

## 10. Command and event flow

A user mutation follows:

```text
UI intent
→ application use case
→ validated domain command
→ domain result/events
→ append operation record
→ update in-memory project
→ schedule persistence
→ update derived views
```

A native job follows:

```text
UI request
→ application job service
→ platform media/connector/AI contract
→ native/provider adapter
→ progress events
→ result validation
→ atomic project update
```

Native adapters must not directly mutate project JSON.

## 11. Job system

All long-running work uses a shared job abstraction.

### Job types

- Media inspect
- Proxy
- Thumbnail
- Waveform
- Managed conversion
- Transcription
- Translation
- AI proposal
- Connector download
- Project package
- Export
- Export validation
- Cache cleanup

### Job states

```text
queued
preparing
running
pausing (only where supported)
cancelling
cancelled
validating
completed
completed_with_warning
failed
```

### Required job fields

- Job ID
- Type
- Project ID
- Optional asset/sequence ID
- Created/started/completed time
- Stage
- Progress units
- Cancellation support
- Retry policy
- Error code and safe message
- Diagnostic reference
- Output references

Jobs must use structured progress, not log-text scraping in the UI.

## 12. IPC contracts

IPC messages are versioned and validated.

Rules:

- Use serialisable request/response/event DTOs.
- Include request IDs.
- Use typed error codes.
- Validate paths in the native layer.
- Do not expose raw shell commands.
- Keep payloads small; use local file references for large data.
- Stream progress through events.
- Cancellation uses job ID.
- Unknown fields are ignored only when forward compatibility is safe.
- Breaking changes require a protocol version increment.

Example:

```ts
interface InspectMediaRequestV1 {
  protocolVersion: 1;
  requestId: string;
  path: string;
}

interface InspectMediaResultV1 {
  requestId: string;
  assetFingerprint: string;
  container: string;
  durationTicks: number;
  videoStreams: VideoStreamInfo[];
  audioStreams: AudioStreamInfo[];
  warnings: MediaWarning[];
}
```

## 13. Persistence strategy

The portable source of truth is versioned JSON plus referenced domain files.

SQLite is used for:

- Derived indexes
- Job history
- Search
- Cached inspection results
- Thumbnail/waveform index
- Operation journal acceleration

The application must be able to rebuild disposable SQLite data from portable project state and local assets.

Project writes use:

1. Validate in memory.
2. Write a new temporary file.
3. Flush.
4. Preserve previous recovery version.
5. Atomically replace the authoritative file.
6. Record the completed checkpoint.

See [`project-format.md`](project-format.md).

## 14. Autosave and recovery

- Operations are journalled continuously.
- Snapshot after approximately two seconds of inactivity.
- Safety snapshot every 30 seconds during active editing.
- Snapshot before export, migration, consolidation, or packaging.
- Rolling recovery snapshots are retained.
- Recovery can open as a copy.
- Partial operation failure must not replace the last valid snapshot.

## 15. Media architecture

Windows:

```text
Project render plan
→ desktop media adapter
→ FFmpeg filter/render graph
→ temporary output
→ FFprobe validation
→ atomic final move
```

DeX:

```text
Project render plan
→ Android media adapter
→ supported Media3/MediaCodec composition
→ temporary output
→ native validation
→ atomic final move
```

The same timeline semantics are translated by each platform adapter. Bit-identical output across platforms is not required, but timing, content, score state, captions, and declared settings must remain consistent.

See [`media-engine.md`](media-engine.md).

## 16. Preview architecture

Preview is not final render.

The preview pipeline may use:

- Proxies
- Reduced quality
- Cached frames
- Hardware decoding
- Simplified effects where explicitly indicated

Requirements:

- Playhead and audio remain synchronised.
- The UI indicates proxy/original and preview quality.
- Unsupported preview effects must be labelled.
- Export always uses the authoritative render plan.
- Preview shortcuts must not mutate quality settings for export.

## 17. AI architecture

```text
Local asset
→ local audio/metadata extraction
→ user consent and provider selection
→ cloud analysis where required
→ normalised transcript/features
→ provider-neutral proposal engine
→ separate proposal sequence
→ user accept/reject/modify
→ reversible domain command
```

Provider output is untrusted input and must be schema-validated.

See [`ai-system.md`](ai-system.md).

## 18. Connector architecture

Remote media is never a timeline source until downloaded into local project storage.

```text
Connector browse/search
→ remote metadata
→ user selection
→ disk and policy checks
→ local download
→ content inspection
→ managed asset registration
→ optional proxy
→ timeline use
```

See [`connector-system.md`](connector-system.md).

## 19. Observability

Local structured logs should include:

- Timestamp
- Severity
- Component
- Project-scoped correlation ID
- Job ID
- Error code
- Safe message
- Diagnostic details without user content where avoidable

Do not log:

- OAuth tokens
- API keys
- Transcript content by default
- Full local paths in shared diagnostics
- Raw provider payloads containing user content
- User media

Diagnostic bundles require explicit user action and should allow review before sharing.

## 20. Error taxonomy

Top-level categories:

- `PROJECT_*`
- `TIMELINE_*`
- `MEDIA_*`
- `EXPORT_*`
- `AI_*`
- `CONNECTOR_*`
- `AUTH_*`
- `STORAGE_*`
- `PLATFORM_*`
- `SECURITY_*`

Every user-visible error includes:

- What failed
- Whether data is safe
- Recovery action
- Diagnostic code

## 21. Performance budgets

Initial engineering targets, subject to reference-hardware validation:

| Area | Target |
|---|---|
| Basic UI response | Visible response within one frame where possible |
| Timeline drag feedback | 60 Hz target, 30 Hz minimum under heavy load |
| Play/pause response | Under 150 ms when media is ready |
| Project open, warm 10-min fixture | Under 3 s target |
| Project open, 120-min indexed fixture | Under 10 s target |
| Command apply | Under 16 ms for ordinary edits |
| Autosave UI interruption | None perceptible |
| Memory growth | No unbounded growth during one-hour edit session |
| Export progress | Structured and monotonic per stage |
| Job cancellation | Acknowledge promptly and clean partial output |

These are quality targets, not permission to corrupt or simplify the project.

## 22. Cross-platform parity policy

Domain parity is required for:

- Timeline meaning
- Project open/save
- Basketball score and clock
- Captions
- AI proposal state
- Asset identity
- Supported editing operations

Media capability parity is not guaranteed.

The application exposes a platform capability matrix so the UI can:

- Disable unsupported exports
- Recommend compatible proxies
- Explain unavailable codecs/effects
- Prevent invalid jobs before execution

## 23. Dependency policy

A major dependency requires discussion when it:

- Adds a new runtime
- Owns project or timeline state
- Adds cloud infrastructure
- Changes media capability
- Has significant binary size
- Handles credentials
- Creates a platform lock-in
- Duplicates an existing capability

All dependencies must have a named owner, purpose, update strategy, and removal path.

## 24. Architecture decision records

Accepted decisions are logged in [`../memory/decisions.md`](../memory/decisions.md).

A new decision record is required for:

- Platform change
- Domain boundary change
- Persistence format change
- Time model change
- Media engine replacement
- Provider selection with lock-in
- New cloud service
- Security model change
- Quality threshold reduction
