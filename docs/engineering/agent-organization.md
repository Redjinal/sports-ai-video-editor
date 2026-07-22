# Agent Organization

> **Status:** Authoritative
> **Authority:** Agent hierarchy, responsibilities, reporting structure, decision rights, activation rules, conflict resolution, and task naming.
> **Last updated:** 2026-07-22

This file governs how AI coding agents are organized for this repository. It combines a
role-based governance model with a code-ownership implementation model: **governance and
decision rights come from the org chart; agent instances are scoped to non-overlapping
packages** so parallel work never collides. `AGENTS.md` remains the operating contract every
agent obeys; this file says who does what and how work flows.

## 1. Design principle

Two organizing forces are reconciled here:

- **By role** (what/why vs how): a Product side that owns workflows, acceptance criteria, and
  user-facing correctness; an Engineering side that owns implementation and reliability.
- **By code ownership** (safe parallelism): every implementation agent maps to a distinct
  package or crate, so two agents never edit the same files.

Where the two conflict, **code-ownership wins for agent boundaries** and **role wins for
decision rights**. Concretely: authoritative project file I/O lives in the Rust
`desktop-storage` crate, not with the timeline agent (DEC-ARCH-010), even though a pure
role model would group "project persistence" under a single timeline-and-project engine.

## 2. Roster

Agents are instantiated **lazily** — only when their milestone is active. Instantiating a
definition for work that is several milestones away just creates something that drifts before
it is used.

### Executive

| Role | Agent (`.claude/agents/`) | Model |
|---|---|---|
| A-00 Product & Delivery CEO | `ceo-orchestrator` | opus |

### Product & Editing Delivery

| Role | Agent | Model | Status |
|---|---|---|---|
| A-10 Department Head | `dept-head-product` | opus | active |
| A-21 Timeline engine | `timeline-domain-agent` | sonnet | active (M3) |
| A-12 UX/UI & interaction | `editor-ui-agent` | sonnet | active |
| A-13 Basketball workflow | *folded into* `basketball-ai-agent` | sonnet | design-only |
| A-14 AI experience | *folded into* `basketball-ai-agent` | sonnet | design-only |
| A-15 Product acceptance QA | `product-acceptance-agent` | sonnet | active |

### Platform, Media & Quality

| Role | Agent | Model | Status |
|---|---|---|---|
| A-20 Department Head | `dept-head-platform` | opus | active |
| A-21 Project persistence / contracts | `contracts-persistence-agent` | sonnet | active |
| A-22 Media & export | `native-media-storage-agent` | sonnet | active |
| A-24 Storage & IPC | *folded into* `native-media-storage-agent` | sonnet | active |
| A-25 Reliability & release QA | `reliability-qa-agent` | sonnet | active |

### Deferred agents (create when the milestone activates)

- **`ai-agent`** (A-23) — split from `basketball-ai-agent` when AI transcription/proposals
  begin (M6/M10).
- **`basketball-domain-agent`** (A-13) — split from `basketball-ai-agent` at the basketball
  milestones (M8/M9).
- **`connectors-dex-agent`** (A-24) — Google Drive/Dropbox/OneDrive/URL/YouTube connectors
  and the Android/Kotlin/DeX layer, at M11 and the DeX milestones. Until then, storage/IPC
  stays with `native-media-storage-agent`.

## 3. The two-way QA split

Product acceptance and technical reliability are **different questions** and must not be one
agent. This project has already been bitten by conflating them (an export file existing is
not proof the export is valid).

- **`product-acceptance-agent` (A-15)** — reports to `dept-head-product`. Validates that
  completed work matches the product spec and the user's workflow: screen states, happy/
  failure paths, minimum viewport, terminology, "AI never silently alters the master." Owns
  product acceptance reports.
- **`reliability-qa-agent` (A-25)** — reports to `dept-head-platform`. Owns fixtures, gate
  selection and enforcement (A–D), security review, exit-criteria runs against the shipping
  path, CI, and release readiness. Blocks on unresolved critical failures.

## 4. Reporting structure

```text
CEO ──▶ Department Head ──▶ Specialist
    ◀──                ◀──
```

- **CEO → Head:** task id, objective, milestone, accepted scope, constraints, expected
  output, collaborating department, quality level, restricted actions.
- **Head → Specialist:** subtask id, parent objective, responsibility, required inputs, files
  permitted to change, required tests/acceptance criteria, expected output, dependencies.
- **Specialist → Head:** summary, work done, files changed, assumptions, validation
  performed, known limitations, risks, decisions required, recommended next action.
- **Head → CEO:** the head **consolidates** specialist reports with real verification; it does
  not forward raw agent output.

Agents do not talk to the user directly; the CEO owns user-facing reporting and any request
for approval.

## 5. Decision rights

- **Product department** decides, within accepted scope: workflow details, screen/panel
  behaviour, terminology, user-visible states, acceptance criteria, interaction consistency.
- **Engineering department** decides, within accepted architecture: internal implementation,
  module boundaries, type/function design, low-risk dependencies, test implementation,
  error-handling mechanisms.
- **CEO** decides: task priority, milestone sequencing, cross-department conflicts, whether
  work meets the objective, and whether a matter escalates to the user.
- **User approval required** (unchanged from `AGENTS.md` §6): Phase 1 scope expansion, major
  architecture change, new core language, new cloud service, new AI provider, timeline schema
  redesign, reduced quality gates, and all commit / push / PR / merge / release / deploy /
  destructive actions.

## 6. Activation model

Do not run the whole org for every task. Cost and coordination scale with agent count.

| Task size | Activate | Typical count |
|---|---|---|
| Small fix | CEO + one head + one specialist (+ `reliability-qa-agent` if code changes) | 3–4 |
| Standard feature | CEO + both heads + 2–3 specialists + both QA agents | 7–9 |
| Milestone / architecture | all agents whose domains are affected | as needed |

A single-track milestone (e.g. M3 timeline kernel) is a *standard feature* activation, not a
full-org one: `dept-head-product` coordinating `timeline-domain-agent` + `editor-ui-agent`,
verified by `reliability-qa-agent` and `product-acceptance-agent`. The CEO need not fan out
to the platform department when a track does not touch it.

## 7. Conflict resolution

1. **Same department:** the head decides using authoritative docs, user value, architecture,
   and testing implications.
2. **Cross-department:** both heads submit the disagreement, each position, relevant accepted
   decisions, options with impact, and a joint recommendation where possible.
3. **CEO** resolves when the answer stays within accepted scope.
4. **User escalation** when it would expand scope, change an accepted decision, materially
   alter architecture, reduce quality, add significant cost, change privacy/data handling, or
   reorder major milestones.

## 8. Task naming

```text
CEO-###    Executive task
PD-###     Product & Design department task
ENG-###    Engineering & Platform department task

UX-###     editor-ui-agent
BASK-###   basketball (basketball-ai-agent, later basketball-domain-agent)
AIX-###    AI experience (basketball-ai-agent, later ai-agent)
PQA-###    product-acceptance-agent

TIME-###   timeline-domain-agent
MEDIA-###  native-media-storage-agent
CONT-###   contracts-persistence-agent
QREL-###   reliability-qa-agent
PLAT-###   connectors-dex-agent (deferred)
```

## 9. Every agent must

1. Read `AGENTS.md` and the authoritative docs for its task.
2. Inspect existing patterns before proposing changes.
3. Stay within its assigned package(s); never edit another agent's files without coordination.
4. Not duplicate authoritative rules — link to the owning doc instead.
5. State assumptions explicitly and add/update tests for behavioural changes.
6. Report unresolved conflicts rather than papering over them.
7. Never commit, push, or release without direct user instruction.

## 10. Relationship to other documents

- `AGENTS.md` — the operating contract; carries a short summary and a link here.
- `docs/engineering/quality-gates.md` — the gates `reliability-qa-agent` enforces.
- `docs/memory/decisions.md` — DEC-GOV-007 records adoption of this structure.
