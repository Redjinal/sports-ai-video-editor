# Security and Privacy Operations

> **Status:** Authoritative  
> **Authority:** Security baseline, privacy controls, secrets, local files, network, and incident response  
> **Version:** 1.0  
> **Last updated:** 2026-07-22

## 1. Scope

This is an internal single-user prototype, not an enterprise platform. It does not require tenant isolation, organisation roles, SSO, audit administration, or regional cloud infrastructure.

It still handles valuable media, local filesystem access, native processes, OAuth tokens, and cloud AI data. Baseline security is mandatory.

## 2. Assets to protect

- Original media
- Project files and operation history
- Exports
- Transcripts and captions
- Team/player data
- Fonts and brand assets
- OAuth tokens
- AI provider credentials
- Local paths and device information
- Diagnostic logs

## 3. Primary threats

- Accidental deletion or overwrite
- Corrupt project writes
- Malicious/corrupt media
- Unsafe FFmpeg command construction
- Path traversal in packages
- Untrusted direct URLs
- OAuth token exposure
- Provider response injection
- Sensitive transcript/media leakage
- Dependency compromise
- Stale temporary files
- Incorrect permissions on local project folders

## 4. Trust boundaries

- React/UI to native IPC
- Application to local filesystem
- Application to FFmpeg/Media3
- Application to AI provider
- Application to connector provider
- Package/archive extraction
- Direct URL network access
- Diagnostic bundle export

Validate at every boundary.

## 5. Credentials

- Store secrets in platform secure credential storage.
- Never store tokens or API keys in project files.
- Never commit credentials.
- Never include secrets in logs, fixtures, screenshots, or diagnostics.
- Request least-privilege OAuth scopes.
- Support disconnect and credential removal.
- Renew consent when provider or data class changes.
- Mask secrets in settings UI.

Environment variables may be used for development but must be documented through example files without values.

## 6. Local file safety

- Use native validated paths.
- Use atomic writes.
- Preserve last valid project.
- Confirm destructive deletion.
- Distinguish cache from durable media.
- Do not follow untrusted symlinks/reparse points during package extraction or cleanup.
- Validate destination remains within the intended root.
- Handle removable drive loss.
- Use unique temporary directories.
- Restrict file permissions where supported.

## 7. Native process safety

For FFmpeg/FFprobe:

- Use executable paths controlled by the application.
- Pass structured argument arrays.
- Never concatenate untrusted strings into a shell command.
- Do not invoke through a shell unless an accepted decision proves it necessary.
- Bound output capture.
- Parse progress separately from logs.
- Kill child process tree on cancellation.
- Validate output before final move.
- Record safe diagnostic code, not raw user data.

## 8. Media validation

Treat media as untrusted.

- Inspect actual content, not extension alone.
- Bound metadata and thumbnail operations.
- Handle corrupt/truncated files.
- Avoid unbounded allocation based on metadata.
- Keep decoders and native libraries updated.
- Use process isolation where practical.
- Do not auto-open embedded links or attachments.
- Reject unsupported font/media formats safely.

Malware scanning is not mandatory for the internal prototype but may be added through scope discussion if external testing increases risk.

## 9. Package/archive security

- Validate manifest before extraction.
- Reject absolute paths.
- Reject `..` traversal.
- Reject paths escaping destination after canonicalisation.
- Limit file count and total expanded size.
- Detect suspicious compression ratios.
- Handle symlinks explicitly.
- Verify checksums.
- Extract to temporary location.
- Validate project before atomic publish.

## 10. Direct URL security

Allow only intended network schemes.

Default policy should reject or require explicit advanced approval for:

- Local file schemes
- Loopback
- Link-local
- Private network ranges
- Unsupported protocols
- Excessive redirects
- DNS rebinding outcomes
- Infinite or oversized responses
- Content mismatch

Set connection, read, total size, and redirect bounds.

## 11. Connector security

- Use official authentication and picker flows.
- Store tokens securely.
- Do not persist signed URLs as durable sources.
- Download to temporary file.
- Verify provider checksum/size where available.
- Inspect actual media locally.
- Handle permission revocation.
- Do not broaden OAuth scopes without an accepted decision.

YouTube integration must not circumvent platform controls or implement unofficial downloading.

## 12. AI privacy

Before cloud AI:

- Show provider
- Show data type
- Show purpose and scope
- Capture consent
- Minimise data
- Prefer audio/transcript/metadata over full-resolution video
- Avoid training use by default where provider settings permit
- Document retention behaviour
- Allow deletion of local AI outputs and temporary extracts

Provider output is untrusted and schema-validated.

## 13. Logging and diagnostics

Default logs:

- Structured
- Local
- Rotated
- Size-limited
- Redacted

Do not log:

- Tokens
- API keys
- Signed URLs
- Transcript content
- Media content
- Full roster details unless required for a local debug mode
- Full absolute paths in shareable diagnostics
- Raw provider payloads

Diagnostic bundle export requires explicit user action and a preview of included categories.

## 14. Network behaviour

- The editor must remain usable offline for local editing.
- Network calls occur only for selected connectors, AI, update checks if later added, and explicit diagnostics.
- Use TLS.
- Validate provider endpoints.
- Bound retries.
- Expose network/cancellation state.
- Do not silently upload project files.

## 15. Dependency and supply-chain controls

- Commit lockfiles.
- Review licences.
- Minimise native dependencies.
- Use trusted package sources.
- Scan dependencies.
- Track FFmpeg/native binary provenance.
- Verify release artefact checksums/signatures where implemented.
- Update critical vulnerabilities promptly.
- Record major dependency changes.

## 16. Updates and release

If auto-update is added later, it requires scope discussion and:

- Signed artefacts
- Trusted update channel
- Rollback plan
- Version verification
- No unsigned code execution

Phase 1 may use manual internal distribution.

## 17. Data deletion

Deletion categories:

- Cache: may be cleared with clear labelling
- Proxy: disposable but warn about regeneration cost
- Managed derivative: durable, explicit confirmation
- Original copied into project: durable, explicit confirmation
- Linked external original: never deleted by project cleanup
- Project: explicit named confirmation and recovery policy
- AI temporary extract: policy-driven secure cleanup where practical
- Credentials: removed on disconnect

## 18. Security error handling

A security rejection must say:

- Operation blocked
- General reason
- Data safety
- Safe next action
- Diagnostic code

Do not expose bypass instructions in standard UI.

## 19. Incident response for prototype

When a suspected security or data-integrity issue occurs:

1. Stop release/distribution.
2. Preserve affected logs without secrets.
3. Identify versions and scope.
4. Reproduce with safe fixtures.
5. Protect user originals and project backups.
6. Revoke affected credentials.
7. Patch and add regression tests.
8. Review similar boundaries.
9. Document impact and recovery.
10. Create a fixed build only after quality/security gates.

## 20. Security review triggers

Review required for:

- New provider
- New connector
- New native dependency
- Archive/package changes
- Direct URL changes
- Credential handling changes
- Auto-update
- Cloud storage
- Collaboration/account scope
- Destructive migration
- New media parser/codec path

## 21. Excluded enterprise controls

Not required in Phase 1:

- SSO/SAML
- Workspace RBAC
- Tenant encryption keys
- Organisation audit console
- Data residency routing
- Compliance certification
- DLP
- Central retention policy
- SIEM integration

Adding external users may justify revisiting these through scope expansion.
