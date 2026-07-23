# Milestone domain status (M5–M12)

> **Status:** Snapshot of the domain-layer build-out across the roadmap · **Author:** agent run, 2026-07-23
> **Scope note:** This file is a map of open PRs and what is / isn't done. It does not restate rules
> (see `AGENTS.md`, `docs/02-phase-roadmap.md`, `decisions.md`). When it disagrees with those, they win.

The platform-neutral **domain layer** for every roadmap milestone M5→M12 now exists as tested
packages, each on its own branch + PR, awaiting review/merge. They were built in parallel as
independent packages (no shared files → no merge conflicts between them). The **native engine**
(Rust/FFmpeg, Media3) and the **editor UI** that consume these domains are the follow-ups — they
need the domains merged first.

## Open PRs

| PR | Milestone | Package / branch | Domain contents | Tests |
|----|-----------|------------------|-----------------|-------|
| #7 | **M5** — canvas, text, graphics | `feature/m5-canvas-graphics` (timeline-domain + editor UI) | keyframeable transforms, text/graphic objects, transitions, templates, **property inspector + program viewer + direct manipulation** | 150 |
| #8 | **M7** — multicam | `feature/m7-multicam` (timeline-domain) *(stacked on #7)* | `MulticamObject`: angles, timecode/manual sync, derived live angle, live switching, editable switch points, active-angle replacement, angle lock, `SetMulticam` command | 92 (domain) |
| #9 | **M6** — audio | `feature/m6-audio-domain` `@sve/audio-domain` | mixer (tracks/buses/master), solo/mute resolution, dB gain math, keyframeable volume automation, fades/crossfade, clip gain | 35 |
| #14 | **M6** — captions | `feature/m6-caption-domain` `@sve/caption-domain` | transcript model + corrections, search, transcript-driven selection, captions + styling, **lossless SRT/VTT**, provider-neutral translation proposal, burn-in descriptor | 59 |
| #10 | **M8** — basketball | `feature/m8-basketball-domain` `@sve/basketball-domain` | event-sourced game log, derived score/fouls/timeouts/on-court, corrections, roster CSV/JSON import, game-clock anchors, event filters + marker conversion | 60 |
| #13 | **M9** — broadcast graphics | `feature/m9-scorebug-domain` `@sve/scorebug-domain` | scorebug templates + view-model + clock formatting, sponsor + player lower thirds, fixed-rate non-destructive replays | 37 |
| #15 | **M10** — AI proposals | `feature/m10-proposal-domain` `@sve/proposal-domain` | scoped assistant commands, **proposal isolation / master-mutation protection**, accept/reject/modify + undo-after-accept, provider-neutral highlight scoring, social reframing | 54 |
| #11 | **M11** — connectors | `feature/m11-connector-domain` `@sve/connector-domain` | remote sources, URL parsing, connection state machine + recovery, download/localisation jobs, self-contained localisation, provider-neutral `Connector` interface, structured errors | 58 |
| #12 | **M12** — export matrix | `feature/m12-export-domain` `@sve/export-domain` | export settings, per-platform capability matrix + fallback, **export validation** (codec/res/fps/duration/A-V sync — an output file is not proof), sidecar/burn-in, certification matrix | 52 |

## Standing constraints honoured

- **AI provider remains unresolved** (per `decisions.md` / `CLAUDE.md`). All AI-touching work
  (caption transcription + translation, M10 highlight scoring, assistant NL parsing) is
  **provider-neutral interfaces only** — no provider selected. Grep-verified: no LLM/vision/cloud
  SDKs, no secrets.
- **AI proposes, the user decides / master-mutation protection:** M10 makes this structural — the
  accept/reject/modify paths don't take the master sequence as a parameter, so they cannot mutate
  it; proven by deep-equality tests.
- **Non-destructive + integer-tick time (27,000,000/s):** every domain models edits as reversible
  instructions over untouched sources; authoritative time is integer ticks throughout.
- **No unofficial YouTube downloader / no secrets** (M11): `YouTubeProjectRef` is metadata/link
  only; localisation strips any re-fetch key so a localised asset has no permanent remote dependency.
- **An output file is not proof of export** (M12): success requires `validateExport` over real probe
  data.
- **No human GUI click-through** was performed anywhere (WebView2 automation resists it from this
  environment); all UI is proven by component tests, all domains by unit tests.

## Follow-ups (not in these PRs)

- **Native engine (Gate C):** Rust/FFmpeg for audio mix render + fades, caption burn-in, multicam
  **waveform-correlation** sync (offsets are *applied* in-domain; computing them from audio is
  native), replay rendering, and actual export execution feeding `validateExport`.
- **Editor UI:** mixer panel, caption/transcript editor, scorebug + basketball event-logger panels,
  multicam 4-up viewer with live switching, connector browser, export dialog — all consume the
  merged domains.
- **AI provider adapters:** behind the caption/translation/scoring/assistant interfaces, pending the
  unresolved decision.

## Merge notes for the reviewer

- **Order:** merge **#7 (M5) first**, then **#8 (M7)** — GitHub will retarget #8 from the M5 branch
  to `main` after #7 merges. The eight `@sve/*-domain` package PRs (#9–#15) are independent of each
  other and of M5/M7 and can merge in any order.
- **Lockfile:** each new package added ~9 lines to `pnpm-lock.yaml`, so sequential merges may show a
  trivial lockfile conflict — resolve by running `corepack pnpm install` after merging.
- **eslint boundary guard:** the root `eslint.config.js` `no-restricted-imports` domain-boundary list
  should be extended to include the seven new `@sve/*-domain` packages (each is already clean of
  forbidden imports; this just wires the guard for the future).
