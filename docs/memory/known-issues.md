# Known Issues, Risks, and Open Decisions

> **Status:** Living risk register  
> **Last updated:** 2026-07-22

## 1. Severity guide

| Severity | Meaning |
|---|---|
| Blocker | Prevents the next milestone or safe release |
| High | Material architecture, data, security, or workflow risk |
| Medium | Important but can proceed with a documented plan |
| Low | Minor or deferred concern |

## 2. Open items

### ISSUE-001 — Permanent product name is not selected

- **Severity:** Low
- **Area:** Product/design
- **Impact:** User-facing copy and package identifiers need placeholders.
- **Current handling:** Use “Sports-Aware AI Video Editor” as a working title; avoid embedding it in schemas.
- **Resolution condition:** User accepts a permanent name and brand decision.

### ISSUE-002 — Rust desktop orchestration is conditional

- **Severity:** High
- **Area:** Architecture
- **Impact:** Native package structure and maintenance depend on the M1 result.
- **Current handling:** Rust/Tauri is selected for the vertical slice.
- **Required evidence:** Process control, progress, cancellation, IPC, packaging, crash isolation, and maintenance comparison.
- **Resolution condition:** Record benchmark outcome and confirm or supersede `DEC-ARCH-003`.

### ISSUE-003 — DeX media capability is unvalidated

- **Severity:** High
- **Area:** Platform/media
- **Impact:** Full editing and 1080p export may vary materially across Samsung devices.
- **Current handling:** Use capability detection and compatible proxies; promise only certified paths.
- **Resolution condition:** Test named S-series devices in DeX with representative 2K sources, four-camera proxy playback, and 720p/1080p export.

### ISSUE-004 — Reference hardware is not named

- **Severity:** Medium
- **Area:** Performance/quality
- **Impact:** Performance budgets and hardware export matrix cannot be certified.
- **Current handling:** Record environment with each benchmark.
- **Resolution condition:** Select one minimum Windows system, one preferred Windows system, and one minimum DeX device.

### ISSUE-005 — AI providers are not selected

- **Severity:** High
- **Area:** AI/privacy/cost
- **Impact:** Transcription quality, speaker separation, translation languages, retention, cost, and adapters remain open.
- **Current handling:** Keep provider-neutral contracts.
- **Resolution condition:** Run a provider evaluation on approved fixtures and record accepted provider choices.

### ISSUE-006 — Cloud AI consent text and retention policy are not final

- **Severity:** Medium
- **Area:** Privacy
- **Impact:** First cloud workflow cannot ship without clear data disclosure.
- **Current handling:** Architecture requires capability-specific consent and data minimisation.
- **Resolution condition:** Select providers and draft provider-specific consent/retention copy.

### ISSUE-007 — Connector OAuth applications are not registered

- **Severity:** Medium
- **Area:** Connectors
- **Impact:** Live Google Drive, Dropbox, and OneDrive flows cannot be tested.
- **Current handling:** Implement contract and mocks first.
- **Resolution condition:** Create development applications, callback configuration, least-privilege scopes, and secure credential setup.

### ISSUE-008 — YouTube publishing scope is not defined

- **Severity:** Low
- **Area:** Connector/product
- **Impact:** Phase 1 integration is limited to authorised metadata/project workflows.
- **Current handling:** No unofficial download path.
- **Resolution condition:** Decide whether publishing is Phase 1, later phase, or excluded.

### ISSUE-009 — Large legal media fixtures are not prepared

- **Severity:** High
- **Area:** Testing
- **Impact:** M1 and long-form certification cannot run reproducibly.
- **Current handling:** Require synthetic or explicitly licensed fixtures.
- **Resolution condition:** Generate/checksum F1–F5 fixtures and document storage.

### ISSUE-010 — Exact proxy encoding parameters are not benchmarked

- **Severity:** Medium
- **Area:** Media/performance
- **Impact:** 720p/1080p profiles may not balance seek responsiveness, size, and quality.
- **Current handling:** Profiles specify resolution/codec but not final GOP/bitrate settings.
- **Resolution condition:** Benchmark on reference Windows and DeX hardware.

### ISSUE-011 — H.265 hardware path varies by device

- **Severity:** Medium
- **Area:** Media
- **Impact:** Export speed and availability differ; DeX H.265 is not promised.
- **Current handling:** Capability detection and software fallback on Windows.
- **Resolution condition:** Certify named GPU/device paths.

### ISSUE-012 — Colour-management scope is minimal

- **Severity:** Medium
- **Area:** Media/quality
- **Impact:** Mixed colour metadata and HDR sources may require conversion policy.
- **Current handling:** Inspect and preserve metadata where possible; advanced colour grading is excluded.
- **Resolution condition:** Define SDR baseline, HDR handling, and warning/normalisation policy before broad best-effort certification.

### ISSUE-013 — SQLite/project JSON split threshold is unknown

- **Severity:** Low
- **Area:** Persistence
- **Impact:** Very large sequence/transcript documents may affect save performance.
- **Current handling:** JSON remains portable truth; SQLite indexes are rebuildable.
- **Resolution condition:** Measure M2/M3 and split only through an accepted migration decision.

### ISSUE-014 — Timeline rendering technology is not selected

- **Severity:** Medium
- **Area:** UI/performance
- **Impact:** DOM, Canvas, WebGL, or hybrid choices affect long-timeline performance and accessibility.
- **Current handling:** Keep timeline domain independent; run a rendering spike before full M3 UI.
- **Resolution condition:** Benchmark range rendering, waveforms, selections, and DeX input.

### ISSUE-015 — Drop-frame timecode display policy is not final

- **Severity:** Medium
- **Area:** Timeline/broadcast
- **Impact:** 29.97/59.94 projects need correct display and user expectations.
- **Current handling:** Rational tick time is correct; display mode remains configurable.
- **Resolution condition:** Define drop/non-drop defaults and tests before M3 completion.

### ISSUE-016 — Caption translation target guarantee is provider-dependent

- **Severity:** Medium
- **Area:** AI/product
- **Impact:** Product cannot promise a fixed set until a provider is selected.
- **Current handling:** Guarantee English source; display provider-supported targets.
- **Resolution condition:** Provider selection and language certification.

### ISSUE-017 — Full scorebug rule details vary by competition

- **Severity:** Low
- **Area:** Basketball
- **Impact:** Bonus, fouls, timeouts, and shot clock differ.
- **Current handling:** Editable presets and unknown/not-configured states.
- **Resolution condition:** Choose initial competition presets after prototype workflow testing.

### ISSUE-018 — Font packaging and licensing workflow needs UX validation

- **Severity:** Low
- **Area:** Brand/project packaging
- **Impact:** Portable projects may reference fonts that cannot be embedded.
- **Current handling:** Report external fonts and keep licensing responsibility with user.
- **Resolution condition:** Test common font scenarios and refine package warnings.

## 3. Resolved items

None yet. Move resolved items here with resolution date and decision/test reference rather than deleting them.

## 4. Waivers

No quality-gate waivers are active.
