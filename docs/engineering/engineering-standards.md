# Engineering Standards

> **Status:** Authoritative  
> **Authority:** Coding, error handling, performance, accessibility, dependency, and implementation conventions  
> **Version:** 1.0  
> **Last updated:** 2026-07-22

## 1. General standard

Code must be:

- Correct before clever
- Explicit at boundaries
- Deterministic in domain logic
- Recoverable around files, jobs, and providers
- Testable without the full application
- Clear about ownership
- Safe for user media and project state

## 2. Supported languages

### TypeScript

Used for:

- Shared domains
- Application services
- React UI
- Shared schemas and contracts

Requirements:

- Strict mode
- No implicit `any`
- Avoid `any`; boundary use requires narrowing immediately
- Prefer discriminated unions
- Exhaustive checks for persistent and command variants
- Use runtime schema validation at external boundaries
- No floating-point authoritative timeline time
- No mutable global domain state

### Rust

Used for desktop-native orchestration.

Requirements:

- `rustfmt`
- `clippy` with warnings treated as failures in CI
- Avoid `unwrap`/`expect` outside tests or demonstrably impossible initialization with explanation
- Structured errors
- Argument arrays rather than constructed shell strings
- Bounded channels and cancellation
- No unsafe code without an accepted decision and targeted tests

### Kotlin

Used for Android/DeX integration.

Requirements:

- Kotlin style/lint
- Coroutines for asynchronous work
- Structured cancellation
- No blocking media work on main thread
- Sealed result/error models
- Lifecycle-aware job handling
- Platform capabilities exposed through contracts

### Python

Permitted for:

- AI experiments
- Evaluation
- Fixture generation
- Development scripts

Python must not become a required editor runtime without scope approval.

## 3. Root quality commands

Once implementation starts, the repository should provide stable root commands:

```text
pnpm format
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm test:visual
pnpm test:media
pnpm check
```

Native checks should be callable from the root where practical.

## 4. Formatting and linting

- Automated formatting is mandatory.
- Lint rules should enforce correctness and dependency boundaries, not personal style.
- Generated files are excluded only through explicit configuration.
- Disabling a rule inline requires a reason where the exception is not self-evident.
- Do not merge formatting-only changes into unrelated large functional diffs unless required.

## 5. Domain modelling

- Prefer immutable inputs and explicit returned state/events.
- Use discriminated unions for object and command variants.
- Model unknown, unavailable, unsupported, and zero as distinct states.
- Derived state must identify its inputs.
- Avoid duplicated authoritative values.
- Keep domain time and IDs opaque through helper types where practical.
- Validate invariants at command and persistence boundaries.

## 6. State management

Separate:

- Persistent project state
- Operational/job state
- Transient workspace state
- Derived state

Rules:

- React component state is not authoritative project state.
- Domain commands mutate project state through application services.
- Selectors compute view state.
- Avoid broad global stores for unrelated panel details.
- Long lists/timelines use incremental or virtualised rendering.
- Background results apply only when preconditions/source versions still match.

## 7. Error handling

Never swallow errors.

Every boundary error should become a structured result with:

- Code
- Safe message
- Technical cause
- Retryability
- Data-safety status
- Recovery action
- Correlation/job ID

User copy should state:

- What failed
- Whether work is safe
- What to do next

Do not expose stack traces, tokens, raw shell output, or sensitive paths in standard UI.

## 8. Async and cancellation

All long-running work:

- Has a job ID
- Reports stage and progress
- Supports cancellation where technically possible
- Handles application shutdown
- Cleans temporary state
- Ignores stale completion events
- Does not block UI thread

Cancellation is a normal outcome, not an error.

## 9. File operations

- Validate paths in native code.
- Use atomic writes for authoritative files.
- Use unique temporary paths.
- Flush before replace where required.
- Preserve prior valid files until new output validates.
- Never delete originals as part of cache cleanup.
- Verify available disk space.
- Handle external drive removal.
- Treat symbolic links and reparse points carefully.
- Avoid following untrusted paths during package extraction.

## 10. Media operations

- Keep FFmpeg/Media3 details behind adapters.
- Build structured command/plan inputs.
- Parse progress into typed events.
- Inspect output after encode.
- Keep original/proxy mapping explicit.
- Do not silently downgrade resolution, codec, frame rate, or source quality.
- Test A/V sync at start, middle, and end.
- Report unsupported capability before launching a job.

## 11. Timeline operations

- Use integer ticks.
- Make operations atomic.
- Provide deterministic inverses or reversible snapshots.
- Do not depend on current UI selection after dispatch.
- Validate lock/target/link behaviour.
- Save/reopen tests accompany new persistent object types.
- Render-plan changes require deterministic snapshot tests.

## 12. AI operations

- Validate provider output.
- Enforce consent before network transfer.
- Minimise uploaded data.
- Keep proposals separate.
- Require explicit acceptance for master mutation.
- Support undo.
- Preserve user corrections.
- Mark stale results when source changes.
- Never execute provider-supplied commands, code, or paths.

## 13. Connector operations

- Localise before timeline use.
- Verify actual downloaded content.
- Use least-privilege credentials.
- Bound retries and redirects.
- Handle cancellation and disk checks.
- Never persist signed URLs as durable asset sources.
- Never implement unofficial YouTube downloading.

## 14. API and IPC contracts

- Version contracts.
- Validate requests and responses.
- Use typed DTOs.
- Include correlation IDs.
- Make optionality explicit.
- Avoid passing large binary data through JSON IPC.
- Avoid breaking changes; provide migrations or protocol negotiation.
- Keep user-facing strings out of native error enums where localisation may later matter.

## 15. Logging

Use structured logging.

Required fields where relevant:

- Timestamp
- Severity
- Component
- Project correlation ID
- Job ID
- Error code
- Safe event name

Do not log:

- Secrets
- OAuth tokens
- Signed URLs
- Transcript/media content by default
- Full user paths in shareable logs
- Raw provider responses containing user data

## 16. Accessibility

All UI work must consider:

- Keyboard navigation
- Visible focus
- Semantic names
- Screen-reader labels
- No colour-only state
- Minimum contrast
- DeX touch hit areas
- Menus as alternatives to right-click
- Reduced motion
- Error association
- Interface scaling

A feature is not done when it works only through hover or precision mouse input.

## 17. Performance

- Measure before introducing complex optimisation.
- Do not render every timeline clip or waveform sample at once.
- Use spatial/range indexing for long timelines.
- Keep domain operations proportional to affected objects where practical.
- Move media and encoding work off UI thread.
- Avoid loading whole long-form files into memory.
- Cache derived data with versioned keys.
- Add a benchmark for any performance-sensitive algorithm.

Performance improvements may not change timeline meaning or output quality silently.

## 18. Dependency standards

Before adding a dependency, document:

- Purpose
- Alternatives
- Maintenance status
- License compatibility
- Binary size impact
- Security exposure
- Platform support
- Exit/removal path

Prefer small focused libraries. Do not add a framework to solve one utility function.

Lockfiles are committed. Security updates follow the release policy.

## 19. Security baseline

- No hard-coded secrets.
- Credentials in secure storage.
- Validate untrusted media and JSON.
- Escape UI content.
- Use safe path handling.
- Restrict network schemes and destinations.
- Redact diagnostics.
- Verify package/checksum where practical.
- Review native and provider dependencies.

See [`../operations/security-operations.md`](../operations/security-operations.md).

## 20. Comments and documentation

Use comments for:

- Invariants
- Non-obvious timing math
- Platform limitations
- Security rationale
- Recovery decisions
- Workarounds with removal conditions

Do not narrate obvious code.

Public domain APIs should have concise documentation and examples for complex operations.

## 21. Feature flags

Feature flags may be used for:

- Incomplete milestone work
- Experimental hardware paths
- Provider rollout
- DeX capability differences

Flags require:

- Owner
- Default
- Removal condition
- Test coverage
- No secret security bypass

## 22. Database and migration standards

- Schema changes are versioned.
- Migration is tested on real fixtures.
- Back up before destructive change.
- Failure preserves old state.
- Avoid storing authoritative project truth only in SQLite.
- Migration requires discussion when destructive or non-backward-compatible.

## 23. Testing expectation

Every behaviour change includes the smallest reliable test that would fail without it.

High-risk areas also require integration or media evidence according to [`testing-strategy.md`](testing-strategy.md) and [`quality-gates.md`](quality-gates.md).

## 24. Review checklist

Before declaring completion:

- Scope is accepted.
- Correct owner/package was used.
- Failure and cancellation are handled.
- Persistent data is versioned.
- Undo/recovery implications are covered.
- Accessibility is covered.
- Security/privacy is covered.
- Required tests pass.
- Documentation and memory are current.
- No unapproved dependency or platform expansion occurred.
