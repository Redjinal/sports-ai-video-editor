# Active State

> **Status:** Living operational memory  
> **Last updated:** 2026-07-22

## 1. Current phase

**Phase 1 — Internal working prototype**

## 2. Current milestone

**M0 — Governance and Contracts: Complete**

The full authoritative Markdown baseline has been created.

## 3. Next milestone

**M1 — Technical Vertical Slice**

Goal:

- Create Windows Tauri shell
- Create React/TypeScript UI
- Establish Rust native bridge
- Inspect one H.264/AAC MP4
- Generate one proxy
- Preview one clip
- Place and trim on a minimal timeline
- Export H.264/AAC MP4
- Validate output

Required architecture spike:

- Benchmark Rust orchestration value and maintenance cost
- Confirm FFmpeg packaging and structured progress
- Confirm cancellation and cleanup
- Record result before broad native implementation

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

Active implementation branch:

```text
spike/windows-media-vertical-slice
```

Commits on this branch were made under direct user instruction. The GitHub remote has not
been created yet — it is pending GitHub CLI authentication.

## 9. Update rules

After each completed task, update:

- Current milestone/status
- Implemented areas
- Branch
- Tests/evidence
- New blockers
- Next recommended work

Keep this file concise. Historical decisions belong in `decisions.md`; defects and unresolved risks belong in `known-issues.md`.
