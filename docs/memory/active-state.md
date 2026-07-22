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
| Repository scaffold | Not started |
| Shared UI | Not started |
| Timeline domain implementation | Not started |
| Project persistence | Not started |
| Desktop native media bridge | Not started |
| Android/DeX adapter | Not started |
| AI provider selection | Unresolved |
| Connector adapters | Not started |
| Test fixtures | Not started |
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

1. Scaffold monorepo.
2. Add formatting, lint, type-check, and test commands.
3. Add minimal shared media contract.
4. Add Tauri Windows shell.
5. Add Rust FFprobe/FFmpeg capability spike.
6. Create legal, synthetic 10-minute certified media fixture.
7. Implement inspect → proxy → preview → trim → export → validate vertical slice.
8. Record benchmark outcome and update architecture decision if needed.

## 7. Current risks

See [`known-issues.md`](known-issues.md). Highest near-term risks:

- DeX capability and performance are unvalidated.
- Rust/Tauri/FFmpeg packaging needs a vertical slice.
- AI provider is not selected.
- Hardware encoding certification matrix is undefined until test hardware is named.
- Large test fixtures need a legal storage/generation plan.

## 8. Branch

No implementation branch has been created.

Suggested next branch:

```text
spike/windows-media-vertical-slice
```

Creating the branch is allowed. Committing or pushing requires direct instruction.

## 9. Update rules

After each completed task, update:

- Current milestone/status
- Implemented areas
- Branch
- Tests/evidence
- New blockers
- Next recommended work

Keep this file concise. Historical decisions belong in `decisions.md`; defects and unresolved risks belong in `known-issues.md`.
