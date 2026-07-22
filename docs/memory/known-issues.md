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

- **Severity:** Medium (was High)
- **Area:** Testing
- **Impact:** M1 and long-form certification cannot run reproducibly.
- **Current handling:** `tools/fixtures/generate-fixtures.mjs` produces synthetic, legally
  clean H.264/AAC fixtures from FFmpeg's own sources. An 8 s F1/F2 fixture is committed and
  checksummed; the 10-minute F3 fixture is generated on demand and git-ignored. Both are
  documented in `fixtures/media/README.md`.
- **Resolution condition:** Extend the generator to F4 (30 min, multicamera) and F5
  (120 min, 2K, four cameras), and document long-term storage for anything not regenerable.

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

### ISSUE-019 — Desktop asset-protocol scope is unrestricted

- **Severity:** Medium
- **Area:** Security/desktop
- **Impact:** `apps/desktop/src-tauri/tauri.conf.json` enables the Tauri asset protocol with
  scope `["**"]` so the preview player can read proxies from arbitrary user paths. That is
  broader than least privilege and would let any page loaded in the webview read any file
  the user can read.
- **Current handling:** Acceptable for a local single-user M1 prototype with a
  locked-down CSP and no remote content loaded.
- **Resolution condition:** Narrow the scope to the project/proxy/managed directories before
  any external release or before the webview ever loads third-party content.

### ISSUE-020 — FFmpeg is discovered, not bundled

- **Severity:** Medium
- **Area:** Media/packaging
- **Impact:** The desktop adapter resolves `ffmpeg`/`ffprobe` from PATH (overridable via
  `SVE_FFMPEG_PATH`/`SVE_FFPROBE_PATH`). A packaged build cannot assume the user has FFmpeg,
  and an unpinned build changes encoder behaviour underneath the certification matrix.
- **Current handling:** Lookup is centralised in `native/desktop-media/src/ffbin.rs`, and the
  app reports availability before any job starts.
- **Resolution condition:** Pin and bundle a known FFmpeg build with the installer, record its
  version in diagnostics, and re-run the media certification matrix against it.

## 3. Resolved items

### ISSUE-002 — Rust desktop orchestration is conditional — **RESOLVED 2026-07-22**

- **Severity when open:** High
- **Resolution:** M1 spike completed, including the comparative benchmark against a Node
  orchestration implementation. Measured parity on every axis (metadata throughput,
  cancellation latency, IPC payload, crash isolation) — there is **no measurable performance
  or safety benefit to Rust**, because all measured work is dominated by the identical
  FFmpeg/FFprobe child processes.
- **Outcome:** `DEC-ARCH-003` is confirmed by `DEC-ARCH-009`, but with a corrected rationale:
  Rust is retained because Tauri already mandates the toolchain and because
  `technical-architecture.md` §6.1 forbids the UI process from executing FFmpeg — not for speed.
- **Reference:** `docs/memory/decisions.md` DEC-ARCH-009;
  `native/desktop-media/tests/benchmark.rs`; `tools/benchmark/node-orchestration.mjs`.
- **Side effect:** the spike exposed a real cancellation defect (cancel was only observed when
  FFmpeg emitted a progress line, so a stalled encode could never be cancelled). Fixed with an
  independent watcher thread; latency improved 203 ms → 49.9 ms.
- **Re-open condition:** if the desktop shell moves off Tauri, the justification no longer
  holds and the decision must be revisited.

## 4. Waivers

No quality-gate waivers are active.
