# Quality Gates

> **Status:** Authoritative  
> **Authority:** Required checks, risk classification, waivers, and release blockers  
> **Version:** 1.0  
> **Last updated:** 2026-07-22

## 1. Policy

Quality gates are risk-based. A small copy change should not run a two-hour render, but timeline, persistence, media, and AI changes require deeper evidence.

A task must use the highest gate triggered by any part of the change.

## 2. Universal baseline

Once commands exist, every code change requires:

- Formatting check
- Lint
- Type check
- Relevant unit tests
- No new unresolved severe dependency vulnerability
- Documentation/memory update where required

## 3. Gate A — Interface

### Trigger

- UI components
- Layout
- Copy
- Styling
- Panel behaviour
- Keyboard interaction
- Accessibility
- Visual state

### Required

- Universal baseline
- Component tests
- Accessibility checks
- Visual regression for affected surfaces
- Keyboard path verification
- Standard desktop viewport
- Minimum `1280 × 800` DeX viewport
- Touch hit-area review where relevant

### Additional when interaction mutates state

Also apply Gate B.

## 4. Gate B — Timeline, project, or domain state

### Trigger

- Timeline commands
- Sequence/track/object model
- Undo/redo
- Basketball events/clock
- Project save/reopen
- Schema/migration
- Relinking
- Nested sequence
- Multicam edit state
- Captions persistence

### Required

- Gate A where UI affected
- Unit tests for domain math/rules
- Operation inverse/undo test
- Save/reopen test
- Serialization validation
- Migration test when applicable
- Locked/targeted-track behaviour where relevant
- Atomic transaction failure test
- Render-plan snapshot/validation when output meaning changes

### Release-blocking failures

- Non-deterministic edit
- Undo mismatch
- Save/reopen mismatch
- Corrupt persistent state
- Broken migration recovery
- Incorrect score or clock derivation

## 5. Gate C — Media engine

### Trigger

- Inspect
- Decode
- Proxy
- Thumbnail/waveform source mapping
- Preview
- Render plan translation
- Audio mix
- Encode/export
- Hardware acceleration
- Media packaging/relink
- Platform media capability

### Required

- Gate B when timeline/persistence affected
- Known-input media fixture
- Container/stream inspection
- Codec verification
- Resolution verification
- Frame-rate verification
- Duration tolerance
- A/V synchronisation
- Sample decode
- Cancellation
- Failure cleanup
- Disk-space failure
- Proxy/original mapping
- Hardware path and fallback where changed
- Output validation

### Feature completion

Use at least an F3 3–10-minute project.

### Milestone completion

Use applicable F4 30-minute fixture.

### Release candidate

Use F5 120-minute 2K four-camera fixture.

## 6. Gate D — AI

### Trigger

- Transcription
- Speaker separation
- Translation
- AI command parsing
- Proposal scoring
- Proposal creation
- Provider adapter
- AI acceptance

### Required

- Universal baseline
- Deterministic provider fixtures
- Schema rejection tests
- Consent tests
- Scope tests
- Evidence/confidence validation
- Proposal sequence isolation
- Accept/reject/modify
- Undo after acceptance
- Stale-source detection
- Master mutation prevention
- Score/clock mutation prevention
- Partial/error/cancellation handling
- User correction preservation

### Provider changes

A live-provider evaluation is required before release certification, but deterministic tests remain the CI authority.

## 7. Connector gate

Connector changes require:

- Contract unit tests
- Mock integration tests
- Auth expiry
- Browse/search pagination
- Download
- Content inspection
- Cancellation
- Retry bounds
- Disk-full
- Duplicate handling
- Security policy
- Offline use

Direct URL changes require SSRF/local-network and redirect tests. YouTube changes require proof that no unofficial download route was added.

## 8. Security gate

Triggered by:

- Credential handling
- File/package extraction
- Direct URL
- Native subprocess
- Provider change
- Auto-update/release
- New dependency with elevated access

Required:

- Threat review
- Secret scan
- Path/argument validation tests
- Logging redaction check
- Dependency review
- Failure and cleanup
- Updated security documentation if contract changed

## 9. Documentation gate

Documentation-only changes require:

- Markdown structure review
- Internal-link validation
- No authority conflicts
- Decision/active-state consistency
- Code examples syntactically plausible
- No secrets or private data

## 10. Performance gate

Triggered by:

- Timeline rendering/indexing
- Media decode/preview
- Project open
- Autosave
- Large schema change
- Proxy/export pipeline
- Memory ownership

Required:

- Before/after benchmark
- Reference environment
- Fixture
- Regression threshold
- Memory observation
- Correctness parity

An optimisation that changes output or domain meaning fails regardless of speed.

## 11. Release blockers

A release cannot proceed with:

- Project data loss
- Timeline corruption
- Save/reopen changing edits
- Persistent A/V drift
- Missing clips or audio in export
- Output marked successful when invalid
- Proxy-to-original relink failure
- AI modifying approved master without acceptance
- Undo failing after AI acceptance
- Score/clock inconsistency after reopen
- Missing required media with no blocking warning
- Credential disclosure
- Path traversal or unsafe command construction
- Unrecoverable autosave/migration failure
- Certification matrix failure for a promised platform/format

## 12. Warning-level release issues

May be accepted explicitly for an internal prototype when documented:

- Minor visual mismatch
- Non-blocking metadata difference
- Best-effort import failure
- Performance below target on unsupported hardware
- Provider-specific quality variance
- Missing optional template

Warning acceptance does not apply to certified media, data integrity, security, or AI control boundaries.

## 13. Waivers

A gate waiver requires:

- Specific failed/missing check
- Reason
- User impact
- Risk
- Temporary mitigation
- Owner
- Expiry/removal condition
- Explicit user acceptance
- Entry in `known-issues.md`

No waiver may hide a release blocker for an external release. Internal prototype waivers must remain visible.

## 14. Required task evidence

Completion report:

```text
Gate applied:
Commands run:
Fixtures used:
Results:
Skipped checks:
Known limitations:
Documentation updated:
```

Do not report a gate passed when a required check was skipped.

## 15. Milestone certification

| Milestone | Minimum gate |
|---|---|
| M0 | Documentation gate |
| M1 | Gate C |
| M2 | Gate B + A |
| M3 | Gate B |
| M4 | Gate C |
| M5 | Gate A + B |
| M6 | Gate C + D |
| M7 | Gate B + C |
| M8 | Gate B |
| M9 | Gate B + C |
| M10 | Gate D |
| M11 | Connector + Security |
| M12 | Gate C + release matrix |
| M13 | All applicable gates + F5 |

## 16. Phase 1 release certification

Required:

- All milestones complete
- No release blockers
- Windows H.264/H.265 matrix
- DeX 720p/1080p matrix
- 120-minute reference project
- Recovery drill
- Package round trip
- Security review
- Known-issues review
- Explicit user instruction before release creation
