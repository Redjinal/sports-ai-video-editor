# Testing Strategy

> **Status:** Authoritative  
> **Authority:** Test layers, fixtures, environments, media verification, AI evaluation, and test cadence  
> **Version:** 1.0  
> **Last updated:** 2026-07-22

## 1. Testing goals

Testing must establish:

- Timeline correctness
- Persistence and recovery
- Media compatibility and A/V synchronisation
- Export validity
- AI proposal isolation
- Basketball score/clock correctness
- Connector reliability
- Minimum DeX usability
- Long-form stability

No single test layer is sufficient.

## 2. Test layers

### 2.1 Unit tests

Fast deterministic tests for:

- Time/rational math
- Timeline commands
- Undo/redo
- Basketball score/clock
- Schema validation
- Render-plan generation
- Caption timing
- Highlight feature scoring
- Path and filename sanitisation

### 2.2 Component tests

For:

- Timeline clips and track headers
- Inspector fields
- Event logger
- Proposal cards
- Export settings
- Connector states
- Recovery and relink UI

### 2.3 Integration tests

Across packages:

- Project create/save/reopen
- Asset import and registration
- Timeline + persistence
- Basketball + scorebug
- Transcript + captions + timeline
- Proposal acceptance + undo
- Connector download + local inspection
- Render plan + platform adapter

### 2.4 End-to-end tests

User-level workflows:

- Create project
- Import
- Edit
- Save/reopen
- Recover
- Multicam
- Basketball logging
- AI proposal review
- Export

E2E tests should control provider/network dependencies through test adapters unless running a designated live-provider suite.

### 2.5 Media-output tests

Use known inputs and inspect output:

- Container/stream presence
- Codec
- Resolution
- Frame rate
- Duration
- A/V sync
- Frame samples
- Audio samples
- Caption outputs
- Truncation
- File plausibility

### 2.6 Visual regression

Capture stable screens at standard desktop and minimum DeX viewport.

### 2.7 Performance and soak tests

Measure:

- Timeline interaction
- Project open
- Proxy queue
- Memory
- One-hour editing session
- 120-minute project
- Long export
- Cancellation cleanup

### 2.8 Recovery and fault-injection tests

Simulate:

- Process crash during save
- App exit during export
- Disk full
- External drive removal
- Corrupt project file
- Partial journal write
- Provider timeout
- Download interruption
- Hardware encoder failure
- Missing original with proxy present

## 3. Fixture policy

Fixtures must be:

- Legally usable
- Non-private
- Small where possible
- Deterministic
- Documented
- Checksummed
- Free of credentials and personal data

Large fixtures may be generated or stored outside Git with a reproducible acquisition/generation process.

## 4. Fixture tiers

### Tier F0 — Pure data

- JSON schemas
- Timeline commands
- Basketball events
- AI responses
- Connector metadata

### Tier F1 — Micro media

Duration: 1–10 seconds.

Use for:

- Decode
- Orientation
- Audio streams
- Codec/container
- Tiny export
- Failure cases

### Tier F2 — Short media

Duration: 10–30 seconds.

Use on every relevant change for:

- Edit/export
- Transition
- Captions
- Multicam switch
- Replay
- A/V sync

### Tier F3 — Feature project

Duration: 3–10 minutes.

Use for feature completion.

### Tier F4 — Milestone project

Duration: 30 minutes, multicamera.

Use for multicam, basketball, and export milestones.

### Tier F5 — Release project

Duration: 120 minutes, 2K, four cameras.

Use for release candidate and long-form hardening.

## 5. Timeline tests

Required categories:

- Common frame-rate conversion
- Drop/non-drop display formatting where supported
- Safe integer range
- Move
- Split
- Standard/ripple trim
- Standard/ripple delete
- Insert/overwrite
- Locked/targeted tracks
- Link groups
- Snapping
- Keyframes
- Transitions
- Nested cycles
- Multicam angle regions
- Replay duration
- Captions
- Social sequence propagation
- Undo/redo
- Serialization
- Render-plan determinism

Property-based tests should generate valid edit sequences and assert invariants and inversion.

## 6. Persistence tests

- Atomic save
- Failed write retains prior file
- Autosave selection
- Recovery as copy
- Stale lock
- Journal tail corruption
- Migration
- Unknown field preservation
- SQLite rebuild
- Missing cache
- Missing media
- Relink ambiguity
- Project package round trip
- Consolidation rollback

## 7. Media tests

### Import

- Certified H.264/AAC MP4
- MP3/AAC/WAV
- PNG/JPEG/WebP
- HEVC conditional
- Variable frame rate
- Rotation
- Multiple audio streams
- Best-effort container
- Truncated/corrupt
- Unsupported codec
- Permission denied

### Proxy

- 720p and 1080p profiles
- Source time mapping
- Regeneration
- Cancellation
- Disk full
- Proxy-only edit
- Original relink

### Export

- H.264/AAC
- H.265/AAC
- Windows resolution matrix
- DeX resolution matrix
- Hardware/software paths
- Audio mix
- Captions
- Nested sequences
- Multicam
- Replay speed
- Graphics
- Validation failure
- Cancellation and cleanup

## 8. A/V synchronisation verification

Use identifiable sync impulses or clap markers.

Check:

- First 10 seconds
- Midpoint
- Last 10 seconds
- Multicam switch boundaries
- Replay boundaries
- Nested sequence boundaries
- Caption/event alignment

Record drift in milliseconds and frames. Fail when tolerance exceeds the fixture’s approved threshold.

## 9. Basketball tests

- Team and roster validation
- 1/2/3-point events
- Same-time ordering
- Wrong-team correction
- Voiding
- Score adjustment
- Player points
- Team fouls
- Period change
- Running/stopped clock
- Multiple correction anchors
- Unknown clock
- AI suggestion approval
- Imported duplicates
- Scorebug view model
- Undo/reopen

## 10. AI tests

### Contract

- Valid/invalid provider response
- Oversized fields
- Unknown operation
- Invalid project ID
- Cancellation
- Partial result
- Consent missing

### Behaviour

- Transcript fixture
- Speaker labels
- User correction preservation
- Translation proposal
- Highlight ranking
- Evidence explanation
- Proposal sequence isolation
- Accept/reject/modify
- Undo acceptance
- Stale source detection
- Master/score/clock mutation prevention

### Evaluation dataset

Maintain a small curated set of basketball and podcast examples with human-labelled:

- Important moments
- Desired context
- Unwanted duplicates
- Speaker segments
- Caption corrections

Do not turn subjective quality into a brittle single numeric unit test. Combine deterministic assertions with review metrics.

## 11. Connector tests

Common:

- Connect/disconnect
- Expiry
- Browse/search pagination
- Download
- Cancellation
- Retry
- Access denied
- Quota
- Disk check
- Duplicate
- Content mismatch
- Offline project use

Direct URL:

- Redirect limits
- Disallowed schemes
- Private/loopback destination policy
- Incorrect content type
- Infinite or oversized stream

YouTube:

- Metadata/auth flow
- No unofficial download path

## 12. UI and accessibility tests

- Keyboard navigation
- Visible focus
- Screen-reader labels
- Error-field association
- Minimum touch targets
- No hover-only action
- Interface scaling
- Reduced motion
- Standard and minimum DeX layout
- Panel collapse/restore
- Timeline keyboard shortcuts

## 13. Visual regression surfaces

- Project Hub
- New Project
- Basketball setup
- Import inspection
- Standard editor
- DeX editor
- Timeline selections
- Multicam
- Event logger
- AI proposal
- Export Centre
- Recovery
- Relink
- Brand Kit

Snapshots require deliberate review; automatic pixel difference alone is not acceptance.

## 14. Performance tests

Initial measurements:

- UI response
- Timeline drag/render
- Project open
- Seek/play latency
- Memory growth
- Autosave interruption
- Proxy throughput
- Export throughput
- Cancellation responsiveness

Use named reference hardware and record:

- CPU
- GPU
- RAM
- Storage
- OS
- Driver/app version

## 15. Test cadence

| Event | Required fixtures |
|---|---|
| Ordinary relevant change | F0–F2 |
| Feature completion | F3 |
| Multicam/basketball milestone | F4 |
| Major release candidate | F5 |
| Codec/platform certification | Applicable format and hardware matrix |

## 16. Live provider tests

Live cloud tests are separate from deterministic CI.

Rules:

- Explicit credentials
- Non-sensitive fixtures
- Usage limits
- Manual or scheduled invocation
- No required success for offline domain PRs
- Result recorded with provider/model version
- Failures distinguished from product regressions

## 17. Flakiness policy

- A flaky test is a defect.
- Do not blindly retry unit tests.
- Limited retry may be used for explicitly networked live suites.
- Quarantine requires owner, issue, reason, and removal condition.
- Quarantined release-blocking coverage must be replaced.

## 18. Test evidence

A completed task reports:

- Commands run
- Environment
- Fixtures
- Pass/fail
- Skipped checks and reason
- Media output paths or hashes where relevant
- Known limitations

## 19. Quality gates

Which tests are required is defined in [`quality-gates.md`](quality-gates.md).
