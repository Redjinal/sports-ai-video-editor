# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Status:** Active entry point · **Last updated:** 2026-07-22

## Authority and reading order

[`AGENTS.md`](AGENTS.md) is the authoritative operating contract for every agent (permissions, scope, planning, testing, documentation, Git). This file adds Claude-specific orientation and session discipline; it must not redefine anything in `AGENTS.md` or the `docs/` authority map.

This repo enforces **one source of truth**: each subject has exactly one normative owner in `docs/`. Prefer linking over restating rules. When documents conflict, the authoritative file wins — record the conflict in `docs/memory/known-issues.md`.

Start every session by reading, in order:

1. [`AGENTS.md`](AGENTS.md)
2. [`docs/memory/active-state.md`](docs/memory/active-state.md) — live status and next milestone
3. [`docs/memory/decisions.md`](docs/memory/decisions.md) — accepted, locked decisions
4. The authoritative document(s) for the task (see the task→docs table in `AGENTS.md` §3)
5. Existing code and tests in the affected area

## Current state: documentation only

**No product code exists yet.** Milestone M0 (governance + full documentation baseline) is complete. The next approved milestone is **M1 — Technical Vertical Slice** (Windows Tauri shell → React UI → Rust FFmpeg bridge → inspect one MP4 → proxy → preview → trim → export → validate; plus a benchmark of Rust's orchestration value).

Do not assume packages, build tooling, or the commands below exist yet — they are the *planned* targets. Verify against the working tree before running anything. The AI provider is **unresolved** and must not be selected without explicit approval.

## Planned commands (do not yet exist)

Once implementation starts, the root will expose stable `pnpm` scripts (package manager is **pnpm**, monorepo). Source of truth: [`docs/engineering/engineering-standards.md`](docs/engineering/engineering-standards.md) §3.

```
pnpm format        pnpm format:check   pnpm lint        pnpm typecheck
pnpm test          pnpm test:integration               pnpm test:e2e
pnpm test:visual   pnpm test:media     pnpm check
```

Rust checks (`rustfmt`, `clippy` with warnings-as-errors) and Kotlin lint should be callable from the root where practical. There is no single-test convention yet; establish one when the test harness lands and record it here.

## Architecture in one screen

A local-first, timeline-first video editor for a solo creator, with basketball broadcast workflows. Windows desktop is primary; Samsung DeX (Android) is a second target with 720p/1080p export. Full architecture: [`docs/architecture/technical-architecture.md`](docs/architecture/technical-architecture.md); repo layout: [`docs/engineering/structure.md`](docs/engineering/structure.md).

**Layered, with strict one-directional dependencies:**

```
apps/editor (React UI)  →  packages/application-services  →  domain + contract packages
apps/desktop (Tauri+Rust) / apps/android (Tauri+Kotlin)   →  implement contracts
```

- **Platform-neutral domains** (`packages/*-domain`, `*-contracts`) hold all rules and must **never** import React, Tauri, FFmpeg, Media3, provider SDKs, or SQLite APIs. Native/media details live only in adapters.
- **Domains never import apps or platform adapters.** Adapters implement contract interfaces. No circular package dependencies.
- **Desktop media** = native FFmpeg/FFprobe behind a Rust adapter (`native/desktop-media`). **DeX media** = Media3/MediaCodec behind a Kotlin adapter. Same timeline semantics, translated per platform; media capability parity is *not* guaranteed (a capability matrix drives UI availability).
- **Persistence**: portable source of truth is **versioned JSON**; SQLite is a *rebuildable* local index (search, job history, caches), never authoritative project truth.
- **Jobs**: all long-running work (inspect, proxy, transcode, transcription, export, download…) flows through one job abstraction with structured progress, cancellation, and validation. UI never executes FFmpeg or holds provider secrets.
- **AI**: cloud analysis, local editing/export. AI *proposes*; the user decides. Proposals land in **separate proposal sequences** — never silently mutating the approved master, score, or clock. Provider output is untrusted and schema-validated.

## Hard invariants (non-negotiable)

These come from `docs/memory/decisions.md` and `AGENTS.md` §8. Violating any is a release blocker.

- **Timeline time is integer ticks at 27,000,000 ticks/second.** Never store authoritative timeline time as floating-point seconds.
- **Never mutate or delete source media.** All edits are non-destructive, reversible project instructions.
- Timeline-domain objects must not couple to FFmpeg, Media3, UI, or provider SDKs.
- **An existing output file is not proof of a successful export** — export success requires output validation (codec/resolution/fps/duration/A-V sync).
- AI suggestions never become official scores, clock values, or master edits without explicit user acceptance; undo must work after acceptance.
- Never swallow errors — every boundary error becomes a structured result (code, safe message, data-safety status, recovery action).
- Do not send full-resolution video to a provider when audio/transcript/metadata suffices.
- No secrets in source, project files, logs, fixtures, or docs. No unofficial YouTube downloader.

## Testing and quality gates

Quality is **risk-based**: a task uses the highest gate any part of its change triggers. Gates: A (interface), B (timeline/domain/persistence), C (media engine), D (AI), plus connector/security/performance/docs. Fixtures are tiered F0–F5 (pure data → 120-min 4-camera). Full rules: [`docs/engineering/quality-gates.md`](docs/engineering/quality-gates.md) and [`docs/engineering/testing-strategy.md`](docs/engineering/testing-strategy.md). Every behaviour change ships with the smallest test that would fail without it. Never report a gate passed when a required check was skipped.

## Git boundary

Claude may create a task branch (`feature/…`, `fix/…`, `refactor/…`, `docs/…`). Claude must **not** commit, push, open/merge a PR, release, deploy, delete branches, or rewrite history without direct instruction.

## Before reporting completion

- Run the risk-appropriate gate; for timeline changes verify save/reopen + undo/redo, for media verify output validation, for AI verify proposal isolation.
- Update [`docs/memory/active-state.md`](docs/memory/active-state.md); update `decisions.md` only for accepted decisions; update `known-issues.md` when material risks change.
- In completion reports, distinguish **implemented and verified** / **implemented but not verified** / **not implemented** / **blocked by an unresolved decision**. Never describe a check as passed unless it ran successfully.
