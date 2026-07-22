# Agent Operating Contract

> **Status:** Authoritative  
> **Applies to:** ChatGPT, Codex, Claude, Claude Code, and any other coding agent  
> **Last updated:** 2026-07-22  
> **Project:** Sports-Aware AI Video Editor

## 1. Purpose

This file is the mandatory entry point for every agent session. It defines how an agent must inspect, plan, implement, test, document, and report work in this repository.

The product is a local-first, timeline-first video editor for a solo creator. It has broad editing capabilities and specialised basketball broadcast workflows. The approved Phase 1 scope is defined in [`docs/01-product.md`](docs/01-product.md) and [`docs/02-phase-roadmap.md`](docs/02-phase-roadmap.md).

## 2. Non-negotiable operating principles

1. **Read before changing.** Inspect the relevant implementation and authoritative documentation before proposing a solution.
2. **Plan before implementation.** Every feature or non-trivial fix begins with a written implementation plan.
3. **Stay inside accepted scope.** Do not add adjacent features because they appear useful.
4. **Discuss scope expansion.** Expansion requires a reasoned proposal and explicit user approval.
5. **Preserve user data.** Source media and project data must never be silently deleted, overwritten, or mutated.
6. **Prefer non-destructive editing.** Timeline edits are stored as reversible project instructions.
7. **AI proposes; the user decides.** AI must not silently modify the approved master sequence.
8. **Use one source of truth.** Do not duplicate normative rules across documents or packages.
9. **Test according to risk.** Apply the gates in [`docs/engineering/quality-gates.md`](docs/engineering/quality-gates.md).
10. **Update project memory.** Update `active-state.md` after completed work and `decisions.md` after accepted product or architecture decisions.

## 3. Required reading order

### For every task

1. This file.
2. [`docs/memory/active-state.md`](docs/memory/active-state.md).
3. [`docs/memory/decisions.md`](docs/memory/decisions.md).
4. The authoritative document for the task.
5. Existing code and tests in the affected area.

### Additional task-specific reading

| Task area | Required documents |
|---|---|
| Product behaviour or screen | [`docs/01-product.md`](docs/01-product.md), [`docs/04-design-system.md`](docs/04-design-system.md) |
| Phase or milestone scope | [`docs/02-phase-roadmap.md`](docs/02-phase-roadmap.md) |
| Basketball workflow | [`docs/03-sports-workflows.md`](docs/03-sports-workflows.md), [`docs/architecture/basketball-domain.md`](docs/architecture/basketball-domain.md) |
| System architecture | [`docs/architecture/technical-architecture.md`](docs/architecture/technical-architecture.md) |
| Media import, proxy, preview, or export | [`docs/architecture/media-engine.md`](docs/architecture/media-engine.md) |
| Timeline behaviour | [`docs/architecture/timeline-domain.md`](docs/architecture/timeline-domain.md) |
| Persistence or packaging | [`docs/architecture/project-format.md`](docs/architecture/project-format.md) |
| AI behaviour | [`docs/architecture/ai-system.md`](docs/architecture/ai-system.md) |
| Cloud import | [`docs/architecture/connector-system.md`](docs/architecture/connector-system.md) |
| Repository placement | [`docs/engineering/structure.md`](docs/engineering/structure.md) |
| Coding conventions | [`docs/engineering/engineering-standards.md`](docs/engineering/engineering-standards.md) |
| Tests | [`docs/engineering/testing-strategy.md`](docs/engineering/testing-strategy.md) |
| Security or privacy | [`docs/operations/security-operations.md`](docs/operations/security-operations.md) |
| Branch, commit, PR, or release | [`docs/operations/git-release.md`](docs/operations/git-release.md) |

## 4. Authority map

Each subject has one normative owner. Other documents may summarise or link to it but must not redefine it.

| Subject | Authoritative file |
|---|---|
| Vision, user, outcomes, constraints | `docs/00-project-brief.md` |
| Phase 1 capabilities and exclusions | `docs/01-product.md` |
| Milestones and sequencing | `docs/02-phase-roadmap.md` |
| Basketball editing workflow | `docs/03-sports-workflows.md` |
| Visual and interaction system | `docs/04-design-system.md` |
| Platform and service architecture | `docs/architecture/technical-architecture.md` |
| Media support and rendering | `docs/architecture/media-engine.md` |
| Timeline semantics and invariants | `docs/architecture/timeline-domain.md` |
| Project persistence and portability | `docs/architecture/project-format.md` |
| AI permissions and proposal model | `docs/architecture/ai-system.md` |
| External media connectors | `docs/architecture/connector-system.md` |
| Basketball data and scoring rules | `docs/architecture/basketball-domain.md` |
| Repository layout and dependencies | `docs/engineering/structure.md` |
| Implementation conventions | `docs/engineering/engineering-standards.md` |
| Test design and fixtures | `docs/engineering/testing-strategy.md` |
| Required checks and release blockers | `docs/engineering/quality-gates.md` |
| Security and privacy controls | `docs/operations/security-operations.md` |
| Git and release procedure | `docs/operations/git-release.md` |
| Accepted decisions | `docs/memory/decisions.md` |
| Current work state | `docs/memory/active-state.md` |
| Known defects, risks, and unresolved choices | `docs/memory/known-issues.md` |
| Agent hierarchy, decision rights, activation, task naming | `docs/engineering/agent-organization.md` |

When documents conflict, the authoritative file wins. Record the conflict in `known-issues.md` and correct the non-authoritative file in the same task when practical.

## 5. Mandatory task workflow

### Step 1 — Inspect

- Read the relevant documents.
- Inspect existing modules, tests, schemas, and naming patterns.
- Identify data-loss, migration, rendering, or cross-platform risks.
- Confirm the task fits the active milestone.

### Step 2 — Plan

For non-trivial work, provide a plan containing:

- Goal
- In-scope behaviour
- Explicit non-goals
- Files or packages likely to change
- Data-model or migration impact
- Test plan
- Risks and fallback

Do not implement until the plan is internally coherent. User confirmation is required only where this contract or the user explicitly requires it.

### Step 3 — Scope check

If the work exceeds accepted scope, stop before implementation and provide:

```text
Proposed expansion
Reason it appears necessary
User value
Technical impact
Architecture impact
Testing impact
Alternative that stays within scope
Recommendation
```

Proceed only after explicit user acceptance.

### Step 4 — Branch

Agents may create a task branch automatically:

```text
feature/<short-task-name>
fix/<short-task-name>
refactor/<short-task-name>
docs/<short-task-name>
```

Do not delete branches or rewrite history.

### Step 5 — Implement

- Follow repository boundaries.
- Use existing patterns before introducing new abstractions.
- Keep platform-neutral domain logic outside native adapters.
- Add errors and recovery paths, not only happy paths.
- Keep changes focused on the accepted task.
- Do not silently relax quality, privacy, or performance requirements.

### Step 6 — Verify

Run the risk-appropriate gate. At minimum, run formatting, linting, type checking, and affected tests once those commands exist.

Media, timeline, persistence, AI, and connector changes require the additional checks defined in `quality-gates.md`.

### Step 7 — Document

- Update `docs/memory/active-state.md` after completing a task.
- Update `docs/memory/decisions.md` only for accepted product, architecture, scope, security, or workflow decisions.
- Update `docs/memory/known-issues.md` when introducing, discovering, resolving, or reclassifying a material risk or defect.
- Update the authoritative document when behaviour or contracts change.

### Step 8 — Report

A completion report must state:

- What changed
- Files or packages affected
- Tests run and results
- Remaining risks or known limitations
- Any user action required

Do not claim success when a required check was not run.

## 6. Autonomy and approval boundaries

### Agents may perform without separate approval

- Inspect the repository and documentation.
- Create a task branch.
- Produce an implementation plan.
- Modify code and documentation within accepted scope.
- Add or update tests.
- Run local checks.
- Fix failures caused by their own changes.
- Create non-sensitive test fixtures.
- Update project memory according to this contract.

### Discussion and explicit acceptance are required before

- Expanding Phase 1 scope.
- Changing the canonical timeline time model.
- Changing persistent project schemas in a non-backward-compatible way.
- Adding a major dependency or new programming language.
- Replacing the media engine or rendering architecture.
- Adding a cloud service or changing an AI provider.
- Changing codec guarantees or platform support.
- Reducing a quality, accessibility, security, or performance threshold.
- Introducing a destructive migration.

### Direct instruction is required before

- Creating a commit.
- Pushing a branch.
- Opening or merging a pull request.
- Creating a release or deploying.
- Deleting branches or rewriting Git history.
- Deleting user media or project data.
- Changing credentials, secrets, or production configuration.
- Running a destructive database or file migration.

## 7. Definition of done

A task is not complete unless:

- Accepted behaviour is implemented.
- Failure and cancellation states are handled.
- Required tests pass.
- Project data remains compatible or has an approved migration.
- User-visible behaviour is documented.
- Accessibility and minimum DeX viewport implications were considered.
- `active-state.md` is current.
- No unapproved scope was added.

For media work, output validation is part of done. For AI work, proposal isolation and undo are part of done. For timeline work, deterministic undo/redo and save/reopen are part of done.

## 8. Prohibited implementation shortcuts

Do not:

- Store authoritative timeline time as floating-point seconds.
- Mutate source media.
- Couple timeline-domain objects to FFmpeg, Media3, UI components, or provider SDKs.
- Treat an existing output file as proof of a successful export.
- Edit remote connector assets in place.
- Send full-resolution video to an AI provider when audio, transcript, or metadata is sufficient.
- Allow AI suggestions to become official scores, clock values, or master edits without approval.
- Hide destructive behaviour behind a generic “Apply” action.
- Catch and discard errors without a user-visible or logged outcome.
- place secrets in source code, project files, logs, fixtures, or documentation.
- claim every FFmpeg-readable format is certified.
- implement an unofficial YouTube downloader.

## 9. Documentation maintenance rules

- Prefer links over repeated normative text.
- Use stable requirement IDs when adding requirements.
- Add a decision record before changing a locked choice.
- Preserve historical decisions; mark them superseded rather than deleting them.
- Date all material updates using `YYYY-MM-DD`.
- Keep `active-state.md` concise and operational.
- Keep `known-issues.md` limited to real risks, defects, and unresolved decisions.

## 9a. Agent organization

Multi-agent work uses a CEO → two department heads → package-scoped specialists structure,
with product-acceptance QA separated from technical/reliability QA. Governance (reporting
templates, decision rights, activation model, conflict resolution, task naming) and the live
roster are authoritative in [`docs/engineering/agent-organization.md`](docs/engineering/agent-organization.md).
Agents are instantiated only when their milestone is active, are scoped to non-overlapping
packages, and never commit/push/release without direct user instruction.

## 10. Current implementation state

The documentation baseline is complete. Product implementation has not started. The next approved milestone is **Milestone 1 — Technical Vertical Slice**.

See [`docs/memory/active-state.md`](docs/memory/active-state.md) for the live status.
