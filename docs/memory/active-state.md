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
| Shared UI | Not started — blocked on desktop toolchain |
| Desktop native media bridge | Not started — blocked on MSVC build tools + Rust |
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

Remaining, blocked on the desktop toolchain (MSVC C++ build tools + Rust):

4. Add Tauri Windows shell.
5. Add Rust FFprobe/FFmpeg capability spike.
7. Implement inspect → proxy → preview → trim → export → validate vertical slice.
8. Record benchmark outcome and update `DEC-ARCH-003` if needed.

### Evidence so far

- `pnpm check` green: format, lint (incl. domain dependency-boundary rules), typecheck, 27 tests.
- Gate B evidence: undo determinism, trim source-bounds rejection, save/reopen round-trip,
  failed-save leaves the prior `project.json` valid.
- Media evidence: `ffprobe` output validated through the inspect schema against the
  committed fixture (container, duration tolerance, codec, resolution, CFR, audio).
- Not yet evidenced: proxy, preview, export, output validation, A/V drift, Rust benchmark.

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
