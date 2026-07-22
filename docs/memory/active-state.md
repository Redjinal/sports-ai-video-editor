# Active State

> **Status:** Living operational memory  
> **Last updated:** 2026-07-22

## 1. Current phase

**Phase 1 — Internal working prototype**

## 2. Current milestone

**M0 — Governance and Contracts: Complete**
**M1 — Technical Vertical Slice: Complete** (merged to `main` 2026-07-22, PR #1)
**M2 — Project System and Editor Shell: Complete** (merged to `main`, PR #2)
**M3 — Timeline kernel (domain): Complete** (PR #4, pre-approved) — editor timeline **UI** still pending

M1/M2 exit criteria met and evidenced. M3 exit criteria met at the domain level
(`packages/timeline-domain/src/exit-criteria.test.ts`): a multi-track edit survives
serialize/reopen and every command has deterministic undo/redo. The M3 domain kernel provides
move, split, standard + ripple trim (out point), standard + ripple delete, insert, overwrite,
snapping, linked A/V, track lock/mute/solo, undo/redo history, markers, and nested sequences —
100 tests. **Remaining for M3:** the editor timeline UI (playhead, zoom/scroll, selection
rendering) in `apps/editor`; ripple trim of the in-point is deferred by decision.

An agent organization was adopted (PR #3, `docs/engineering/agent-organization.md`,
DEC-GOV-007): CEO → two department heads → package-scoped specialists, with product-acceptance
QA split from reliability QA.

## 3. Next milestone

**M2 — Project System and Editor Shell: implemented, awaiting review**

### M2 exit criteria — MET

*"A project can be created, saved, closed, reopened, recovered, duplicated, and relinked
without losing timeline state."*

Driven as one continuous sequence against the shipping storage path
(`cargo test -p desktop-storage --test exit_criteria`): create → save an edit → reopen →
recover a pre-edit snapshot as a copy → duplicate → move the media offline → relink. Every
step asserts the timeline object is unchanged, and the project is verified to survive total
loss of the SQLite index.

### Gate evidence

- **Gate B:** 17 storage tests against real files — atomic save, a rejected save leaving the
  previous project openable, recovery rotation and recover-as-copy, duplicate, delete
  refusing a non-project folder, schema-too-new refusal, `..` path rejection,
  missing-media/relink, index rebuildability.
- **Gate A / interface:** 23 DOM tests — keyboard-operable panel separators with ARIA value
  and orientation, min-size refusal, collapse with `aria-expanded`, delete requiring an
  explicit confirmation that names the folder, a missing project folder disabling Open, and
  save failures surfacing rather than reporting success.
- **Autosave:** 8 tests — idle snapshot, safety cadence, flush-before-risky-operation, a
  failed autosave staying dirty, and an edit arriving mid-write not being swallowed.
- **Viewport:** the app was resized to exactly 1280×800 (client 1265×762) and rendered with
  all controls visible and no clipped content.
- Totals: `pnpm check` 59 tests; `cargo test` 25 tests; clippy `-D warnings` and fmt clean.

### Not verified

- No human has driven the full flow through the GUI; the exit-criteria sequence is proven at
  the storage layer and the UI is proven by DOM tests, but the two have not been exercised
  together by hand.
- Horizontal-overflow at 1280×800 was judged visually, not measured programmatically.
- Carried from M1: preview A/V sync has no impulse-based drift measurement.

---

**Original M2 definition**

Deliverables: Project Hub, New Project, local folder layout, versioned manifest, SQLite
index, project open/close, manual save, autosave and recovery, duplicate and delete,
missing-media detection, relinking, editor shell, resizable/collapsible panels, minimum
DeX viewport behaviour.

Exit criteria: *a project can be created, saved, closed, reopened, recovered, duplicated,
and relinked without losing timeline state.* Gate: Timeline/Persistence Gate B plus
interface checks.

Already in place from M1 (reuse, do not rebuild):

- Versioned manifest + schema validation — `@sve/project-domain`
- Local folder layout (`project.json`, `operations/`, `autosaves/`) and atomic save with
  recovery rotation + journal checkpoint — `@sve/persistence`
- Timeline model and reversible commands — `@sve/timeline-domain`
- Asset record with `online | offline | proxy_only | invalid` status, ready for
  missing-media detection and relinking

Not yet built for M2: SQLite index, autosave scheduling/recovery UX, duplicate/delete,
missing-media detection, relinking, Project Hub and New Project screens, and the resizable
editor shell.

### Carried over from M1 (not blocking M2)

- A/V sync is only machine-checked by duration; no impulse-based drift measurement exists,
  and no human has watched the preview.
- No GUI click-through of the slice has been performed.
- ISSUE-019 (asset-protocol scope `**`) and ISSUE-020 (FFmpeg discovered, not bundled).

## 4. Implementation status

| Area | Status |
|---|---|
| Product documentation | Complete |
| Architecture documentation | Complete |
| Engineering/operations documentation | Complete |
| Version control | Complete — git initialised; GitHub remote pending authentication |
| Repository scaffold | Complete — pnpm workspace, strict TS, ESLint boundaries, Prettier, Vitest |
| Quality commands | Complete — `pnpm check` (format, lint, typecheck, test) green |
| Media contracts | Complete — inspect/proxy/render-plan/export-job DTOs + zod validation |
| Timeline domain implementation | Partial — tick model, sequence/track/object model, Add/Remove/Trim commands with inverses, serialization |
| Project persistence | Partial — versioned manifest, atomic save with recovery rotation, save/reopen verified |
| Shared UI | Partial — M1 slice shell (import/inspect/proxy/preview/place/trim/export/validate) |
| Desktop native media bridge | Complete for M1 — Tauri v2 shell + Rust FFmpeg/FFprobe adapter |
| Android/DeX adapter | Not started |
| AI provider selection | Unresolved |
| Connector adapters | Not started |
| Test fixtures | Partial — synthetic 8s H.264/AAC F1/F2 committed; 10-min F3 reproducible via generator |
| Release pipeline | Not started |

## 5. Current locked scope

- Sports-aware general editor
- Basketball first
- Windows primary
- DeX editing with 720p/1080p export
- Four cameras
- Multiple video/audio tracks
- Local projects and exports
- Cloud-assisted AI
- Separate proposal sequences
- No visual sports AI
- No account/team backend
- Risk-based quality gates

See [`decisions.md`](decisions.md).

## 6. Immediate recommended work

Completed in the current M1 pass (branch `spike/windows-media-vertical-slice`):

1. ~~Scaffold monorepo.~~ Done.
2. ~~Add formatting, lint, type-check, and test commands.~~ Done.
3. ~~Add minimal shared media contract.~~ Done.
6. ~~Create legal, synthetic certified media fixture.~~ Short fixture done and
   committed; the 10-minute F3 fixture is generated on demand.

4. ~~Add Tauri Windows shell.~~ Done.
5. ~~Add Rust FFprobe/FFmpeg capability spike.~~ Done.
7. ~~Implement inspect → proxy → preview → trim → export → validate vertical slice.~~ Done.
8. ~~Record benchmark outcome and update `DEC-ARCH-003` if needed.~~ Done — comparative
   benchmark run against a Node orchestration implementation; `DEC-ARCH-003` confirmed by
   `DEC-ARCH-009` on process-boundary grounds (not performance); ISSUE-002 closed.

### M1 exit criteria — MET

Roadmap §5: *"A ten-minute H.264/AAC MP4 can be imported, proxied, previewed, trimmed,
exported, and validated without corruption or material A/V drift."*

Run 2026-07-22 (`cargo test -p desktop-media --test exit_criteria -- --ignored`) on the
generated 600 s 1080p30 fixture:

| Stage | Result |
|---|---|
| Inspect | `certified`, h264 1920×1080 30.000 fps, aac, 600 s, 95 ms |
| Proxy | 1280×720, 55 s, 108.6 MB, duration preserved 1:1 |
| Trim + export | 120 s sub-range from 60 s in, 1080p H.264/AAC, 30.7 s |
| Validate | all 12 required checks passed, 3.0 s |
| Duration drift | **0 ticks** (one frame = 900,000 ticks) |

### Evidence

- `pnpm check` green: format, lint (incl. domain dependency-boundary rules), typecheck, 27 tests.
- `cargo test` green: 8 tests (3 unit + 5 pipeline); `cargo clippy -D warnings` and
  `cargo fmt --check` clean for both crates.
- Gate B: undo determinism, trim source-bounds rejection, save/reopen round-trip,
  failed-save leaves the prior `project.json` valid.
- Gate C: inspect/proxy/export/validate on real media; **a truncated render is rejected**;
  cancellation unwinds and leaves no partial file.
- App launches with a responding 1440×900 window and renders all four slice stages.

### Not yet evidenced

- Preview playback and A/V sync were **not** verified by a human watching the proxy; only
  durations and decodability are machine-checked. No impulse-based drift measurement yet.
- No GUI click-through of the full flow was performed — the pipeline is proven at the
  library/IPC level, not through the rendered controls.
- Nothing merged to `main`; the slice lives on the spike branch pending review.

## 7. Current risks

See [`known-issues.md`](known-issues.md). Highest near-term risks:

- DeX capability and performance are unvalidated.
- Rust/Tauri/FFmpeg packaging needs a vertical slice.
- AI provider is not selected.
- Hardware encoding certification matrix is undefined until test hardware is named.
- Large test fixtures need a legal storage/generation plan.

## 8. Branch

`spike/windows-media-vertical-slice` was merged to `main` via PR #1 on 2026-07-22.
`main` is the current baseline; no implementation branch is open.

Remote: https://github.com/Redjinal/sports-ai-video-editor (public).

Suggested next branch:

```text
feature/m2-project-system
```

## 9. Update rules

After each completed task, update:

- Current milestone/status
- Implemented areas
- Branch
- Tests/evidence
- New blockers
- Next recommended work

Keep this file concise. Historical decisions belong in `decisions.md`; defects and unresolved risks belong in `known-issues.md`.
