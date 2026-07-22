# Repository Structure

> **Status:** Authoritative  
> **Authority:** Repository layout, package responsibilities, dependency direction, and code placement  
> **Version:** 1.0  
> **Last updated:** 2026-07-22

## 1. Repository model

Use a monorepo so shared domains, UI, platform shells, native adapters, tests, and documentation evolve together.

Expected package manager for TypeScript work: `pnpm`.

## 2. Target tree

```text
/
├── AGENTS.md
├── CLAUDE.md
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.*
├── prettier.config.*
│
├── apps/
│   ├── editor/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── screens/
│   │   │   ├── panels/
│   │   │   ├── viewer/
│   │   │   ├── timeline/
│   │   │   ├── inspectors/
│   │   │   ├── commands/
│   │   │   └── workspace/
│   │   └── tests/
│   │
│   ├── desktop/
│   │   ├── src/
│   │   ├── src-tauri/
│   │   └── tests/
│   │
│   └── android/
│       ├── src/
│       ├── native/
│       └── tests/
│
├── packages/
│   ├── timeline-domain/
│   ├── project-domain/
│   ├── basketball-domain/
│   ├── media-contracts/
│   ├── ai-contracts/
│   ├── connector-contracts/
│   ├── application-services/
│   ├── editor-ui/
│   ├── design-system/
│   ├── caption-engine/
│   ├── command-history/
│   ├── persistence/
│   ├── telemetry/
│   └── test-fixtures/
│
├── native/
│   ├── desktop-media/
│   ├── desktop-storage/
│   └── android-media/
│
├── tools/
│   ├── fixtures/
│   ├── media-validation/
│   ├── schema/
│   └── release/
│
├── tests/
│   ├── e2e/
│   ├── media/
│   ├── performance/
│   ├── visual/
│   └── recovery/
│
├── fixtures/
│   ├── media/
│   ├── projects/
│   ├── transcripts/
│   ├── basketball/
│   ├── ai/
│   └── connectors/
│
└── docs/
    └── ...
```

The exact Tauri/Android generated subfolders may differ, but package responsibilities and dependency rules remain.

## 3. Application packages

### `apps/editor`

Shared React application.

Owns:

- Screen composition
- Panel composition
- Timeline presentation and interaction
- Viewer presentation
- Inspector presentation
- Workspace state
- User intent dispatch
- Keyboard routing

Does not own:

- Domain rules
- Native media execution
- Provider SDKs
- Project database implementation

### `apps/desktop`

Windows desktop shell.

Owns:

- Tauri configuration
- Native command/event registration
- Window lifecycle
- Desktop packaging
- Capability bootstrapping
- Desktop-specific menus and file dialogs

### `apps/android`

Android/DeX shell.

Owns:

- Tauri mobile configuration
- Android lifecycle
- DeX capability integration
- Native permission flow
- Android packaging
- Android-specific file chooser and system UI

## 4. Domain packages

### `packages/timeline-domain`

Owns:

- Tick/rational time
- Sequences, tracks, and timeline objects
- Editing commands
- Invariants
- Undo-ready mutation results
- Render-plan inputs
- Serialization schemas

May depend only on shared utility/schema packages explicitly approved.

### `packages/project-domain`

Owns:

- Project identity
- Asset registry
- Project settings
- Sequence registry
- Brand/template references
- Version and migration contracts
- Packaging contracts

### `packages/basketball-domain`

Owns:

- Game, team, player, and rules
- Event and correction logic
- Score and basic statistics
- Clock anchors
- Scorebug view model

### `packages/media-contracts`

Owns:

- Platform-neutral inspect/proxy/render/export DTOs
- Capability matrix
- Media errors
- Job events

Contains no FFmpeg or Media3 imports.

### `packages/ai-contracts`

Owns:

- Transcript/caption analysis requests
- AI scope
- Proposal/evidence schemas
- Consent policy contracts
- AI errors

### `packages/connector-contracts`

Owns:

- Connection state
- Remote asset metadata
- Browse/search/download contracts
- Connector errors

## 5. Application and UI packages

### `packages/application-services`

Coordinates domains and adapters.

Examples:

- CreateProject
- ImportMedia
- ExecuteTimelineCommand
- StartProxyJob
- GenerateTranscript
- CreateHighlightProposals
- ExportSequence
- PackageProject

It may depend on domain and contract packages. It receives adapters through interfaces.

### `packages/editor-ui`

Reusable editor-specific components:

- Timeline clip
- Track header
- Media browser
- Property sections
- Transport
- Proposal card
- Event logger

### `packages/design-system`

Generic tokens and primitives:

- Colours
- Typography
- Spacing
- Buttons
- Fields
- Menus
- Dialogs
- Panel
- Tabs
- Status indicators
- Focus/accessibility utilities

It must not import timeline or basketball domain packages.

### `packages/caption-engine`

Provider-neutral caption segmentation, line breaking, style resolution, import/export normalisation, and timing helpers.

### `packages/command-history`

Generic command grouping, transaction, undo/redo, checkpoint, and history-label support. Timeline-specific commands remain in `timeline-domain`.

### `packages/persistence`

Project repository interfaces, JSON serializer, journal, SQLite index adapters, migration runner, and atomic-file utilities.

### `packages/telemetry`

Local structured logging, diagnostic IDs, and opt-in diagnostic bundle creation. No remote telemetry is assumed.

### `packages/test-fixtures`

Fixture builders and helpers that are safe to share across unit and integration tests.

## 6. Native packages

### `native/desktop-media`

Rust crate(s) for:

- FFmpeg/FFprobe process management
- Structured progress
- Cancellation
- Temporary file lifecycle
- Export validation
- Media capability detection

### `native/desktop-storage`

Rust crate(s) for:

- Safe path handling
- Atomic files
- Project locks
- Packaging
- Secure credential bridge where appropriate

### `native/android-media`

Kotlin module for:

- Media3/MediaCodec adapter
- Android capability inspection
- Preview/export execution
- Android file access
- Progress/cancellation
- Validation

## 7. Dependency direction

Allowed:

```text
apps → application-services → domains/contracts
apps → editor-ui → design-system
platform adapters → contracts
persistence adapters → project-domain interfaces
tests → any public package under test
```

Prohibited:

```text
domain → app
domain → React
timeline-domain → basketball UI
timeline-domain → FFmpeg/Media3
design-system → editor domain
shared package → platform shell
desktop adapter → Android adapter
provider adapter → UI
```

Use dependency checks in CI once packages exist.

## 8. Feature placement

Examples:

| Change | Location |
|---|---|
| Timeline split rule | `packages/timeline-domain` |
| Split button | `packages/editor-ui` or `apps/editor` |
| FFmpeg split/render implementation | `native/desktop-media` |
| Basketball score calculation | `packages/basketball-domain` |
| Basketball event panel | `apps/editor` / `packages/editor-ui` |
| AI proposal schema | `packages/ai-contracts` |
| OpenAI/other provider adapter | platform/application provider adapter, not contract package |
| Google Drive adapter | connector adapter module |
| Project JSON migration | `packages/persistence` |
| Dark palette token | `packages/design-system` |
| Export centre screen | `apps/editor` |
| H.265 capability probe | native media adapter |

## 9. Folder conventions

Within a TypeScript package:

```text
src/
├── index.ts
├── domain/
├── application/
├── adapters/
├── schemas/
├── errors/
└── internal/
```

Use only folders that match actual responsibility. Avoid empty architectural scaffolding.

Tests may be:

- Co-located as `*.test.ts` for unit tests
- In `tests/` for integration or package-level scenarios

## 10. Public APIs

Every package exposes a deliberate public surface through `src/index.ts` or package export maps.

Do not deep-import private implementation folders across packages.

Breaking a package public API requires:

- Impact review
- Updated consumers
- Tests
- Decision record when architectural

## 11. Naming

- TypeScript packages: kebab-case
- TypeScript types/classes: PascalCase
- Functions/variables: camelCase
- Constants: `UPPER_SNAKE_CASE` only for true constants
- Rust crates/modules: snake_case
- Kotlin packages: lowercase dot notation
- Persistent IDs: opaque prefixed strings
- Requirement IDs: area prefix + number
- Error codes: `AREA_SPECIFIC_REASON`

Avoid generic names such as `utils`, `helpers`, `manager`, or `common` when a narrower responsibility exists.

## 12. Generated files

Generated code must:

- Be placed in an explicit `generated/` directory
- Include generation source and command
- Not be hand-edited
- Be reproducible
- Be checked in only when build/release reliability requires it

## 13. Schema placement

Persistent schemas live beside their owning domain or persistence adapter:

- Timeline schemas: `timeline-domain`
- Basketball schemas: `basketball-domain`
- Project manifest: `project-domain` / `persistence`
- IPC DTOs: relevant contract package
- Provider raw schemas: provider adapter, not shared domain

## 14. Fixture placement

- Small source files: `fixtures/media`
- Project snapshots: `fixtures/projects`
- AI normalised responses: `fixtures/ai`
- Basketball games/events: `fixtures/basketball`
- Connector mock payloads: `fixtures/connectors`
- Generated large fixtures: created by tools, not necessarily committed

Do not commit copyrighted or private footage.

## 15. Documentation proximity

Normative documentation remains in `docs/`.

Package-level README files may explain local use but must link to, not redefine, authoritative contracts.

## 16. Build artefacts

Build output, caches, exports, generated user projects, credentials, and local media must be Git-ignored.

## 17. Ownership rule

Every new package must state:

- Responsibility
- Allowed dependencies
- Public API
- Test strategy
- Why an existing package cannot own the code

Creating a package solely to avoid choosing an owner is prohibited.
