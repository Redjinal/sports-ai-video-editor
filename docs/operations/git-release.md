# Git and Release

> **Status:** Authoritative  
> **Authority:** Branches, commits, pull requests, versioning, release, and agent Git permissions  
> **Version:** 1.0  
> **Last updated:** 2026-07-22

## 1. Principles

- Keep changes scoped.
- Preserve readable history.
- Do not publish unverified work as complete.
- Separate local implementation authority from publication authority.
- Releases are explicit, reproducible, and validated.
- User/project data migrations receive extra review.

## 2. Agent permissions

Agents may:

- Inspect Git state
- Create a task branch
- Modify files
- Run tests
- Prepare a proposed commit message
- Show a diff summary

Agents require direct instruction before:

- Commit
- Push
- Open a pull request
- Merge
- Tag
- Release
- Deploy
- Delete a branch
- Rewrite history
- Force push

## 3. Branch model

Use short-lived task branches.

```text
feature/<task-name>
fix/<task-name>
refactor/<task-name>
docs/<task-name>
spike/<task-name>
```

Examples:

```text
feature/timeline-tick-model
fix/export-validation-duration
docs/media-engine-contract
spike/rust-media-orchestration
```

Branch names use lowercase kebab-case.

## 4. Branch creation

Before creating a branch:

- Confirm current worktree status.
- Do not discard unrelated changes.
- Base on the intended branch.
- Record branch in `active-state.md` when implementation begins.

If unrelated uncommitted work exists, do not overwrite or stash it without instruction.

## 5. Commit policy

Commits require explicit user instruction.

A commit should:

- Represent one coherent change
- Include tests/documentation where relevant
- Avoid generated user media
- Avoid secrets
- Avoid unrelated formatting
- Pass applicable checks or state known failures

Suggested format:

```text
<type>(<scope>): <summary>
```

Types:

- `feat`
- `fix`
- `refactor`
- `test`
- `docs`
- `build`
- `ci`
- `chore`
- `perf`

Examples:

```text
feat(timeline): add rational tick conversion
fix(export): reject truncated output
docs(ai): define proposal isolation
```

## 6. Commit body

Use a body when needed to explain:

- Why
- Behaviour change
- Migration
- Risks
- Tests
- Follow-up

Do not use a commit message as the only documentation for an architectural decision.

## 7. Pull requests

Opening a PR requires direct instruction.

PR description should include:

- Goal
- Scope
- Non-goals
- Key changes
- Screens or user flow
- Data/migration impact
- Risk
- Gate applied
- Tests and fixtures
- Screenshots/media evidence
- Known limitations
- Documentation updates

A PR must link accepted scope or issue where available.

## 8. Review expectations

Review high-risk areas for:

- Timeline invariants
- Undo/redo
- Save/reopen
- Media source mapping
- Output validation
- Score/clock correctness
- AI permission boundary
- Credential/file safety
- Cross-platform capability
- Dependency direction

## 9. Merge policy

- No direct merge by an agent without instruction.
- Prefer a clean merge strategy selected by the human maintainer.
- Do not merge with unresolved release blockers.
- Required gates must pass or have accepted waiver.
- Migrations require tested backup/recovery.
- Update `active-state.md` after merge when instructed or in the next task.

## 10. Versioning

Use semantic versioning once distributable builds begin:

- Major: incompatible project format or public contract with no automatic migration
- Minor: backward-compatible feature milestone
- Patch: backward-compatible fix

Internal pre-release examples:

```text
0.1.0-alpha.1
0.1.0-alpha.2
0.2.0-beta.1
```

Project schema version is separate from application version.

## 11. Release channels

Phase 1 may use:

- Development
- Internal alpha
- Internal beta
- Release candidate
- Internal prototype release

No public/stable promise is implied.

## 12. Release artefacts

Windows:

- Signed installer/package when signing is available
- Version metadata
- Bundled/native media dependencies
- Checksums
- Release notes
- Licence notices

DeX/Android:

- Signed APK/AAB according to internal distribution method
- Version metadata
- Checksums
- Release notes
- Licence notices

Do not share private signing keys.

## 13. Release checklist

### Scope

- Milestone and release scope accepted
- No unapproved expansion
- Decisions current
- Known issues reviewed

### Quality

- Required gates pass
- Certification matrix pass
- Reference project pass where required
- Recovery and package drill
- No release blockers
- Waivers documented

### Security

- Secret scan
- Dependency review
- Native binary provenance
- Credential/log review
- Package path review
- Direct URL/connector review where changed

### Data

- Project schema compatibility
- Migration backup/failure test
- Old project fixture open/save
- New project reopen
- No unintended cache/original deletion

### Artefacts

- Version set consistently
- Build reproducible
- Installer/package smoke test
- Checksums
- Release notes
- Licence notices

### Approval

- Explicit instruction to tag/build/publish
- Distribution destination confirmed

## 14. Release notes

Include:

- Version/date
- Intended audience
- New capabilities
- Fixed defects
- Project-format changes
- Media compatibility changes
- Known issues
- Upgrade/rollback notes

Do not claim support beyond certified formats/platforms.

## 15. Migrations

A release with project migration must:

- Detect old schema
- Back up
- Explain migration
- Apply atomically
- Preserve original on failure
- Record migration version
- Test package/recovery
- Document minimum reader version

Destructive migrations require explicit approval.

## 16. Rollback

Rollback strategy must consider:

- Application binary
- Project schema
- Native media binaries
- Cached derived data
- Connector/provider contracts

An application rollback cannot safely open a project requiring a newer minimum reader version. The release notes must state this.

## 17. Hotfixes

Hotfix branch:

```text
fix/<critical-issue>
```

A hotfix still requires applicable targeted gates. Data integrity, security, and export validation fixes cannot bypass testing because of urgency.

## 18. Changelog and decisions

- User-visible changes go to release notes/changelog once releases begin.
- Architectural/product choices go to `docs/memory/decisions.md`.
- Current branch/task goes to `docs/memory/active-state.md`.
- Deferred defects go to `docs/memory/known-issues.md`.

## 19. Forbidden Git actions without instruction

- `git reset --hard`
- Force push
- Rebase or rewrite shared history
- Branch deletion
- Tag deletion
- Cleaning untracked files that may contain user work
- Committing generated media, projects, credentials, or secrets
