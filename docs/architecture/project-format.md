# Project Format

> **Status:** Authoritative  
> **Authority:** Project folder layout, persistence, versioning, autosave, migration, relinking, and packaging  
> **Version:** 1.0  
> **Last updated:** 2026-07-22

## 1. Goals

The project format must be:

- Local-first
- Human-inspectable where practical
- Versioned
- Recoverable
- Portable
- Efficient for two-hour projects
- Independent from one database implementation
- Safe under crashes and interrupted writes
- Able to relink moved media
- Able to rebuild disposable caches

## 2. Project folder

Recommended layout:

```text
<Project Name>/
├── project.json
├── project.db
├── operations/
│   └── journal.ndjson
├── autosaves/
├── media/
├── managed/
├── proxies/
├── thumbnails/
├── waveforms/
├── transcripts/
├── captions/
├── templates/
├── brand/
├── cache/
├── temp/
├── exports/
└── logs/
```

### Required

- `project.json`
- `operations/`
- `autosaves/`

### Created on demand

All other directories.

## 3. Source-of-truth policy

### Portable authoritative state

- `project.json`
- Referenced domain JSON files if the project is later split
- Durable transcript/caption files
- User templates and brand assets stored in project
- Managed media derivatives when selected

### Rebuildable state

- `project.db` indexes
- Thumbnails
- Waveforms
- Preview cache
- Temporary render segments
- Derived score/statistics cache
- Search indexes

A corrupt or missing rebuildable file must not make the project unrecoverable.

## 4. Project manifest

Minimum structure:

```json
{
  "schemaVersion": 1,
  "projectId": "prj_...",
  "name": "Home vs Away",
  "createdAt": "2026-07-22T00:00:00Z",
  "updatedAt": "2026-07-22T00:00:00Z",
  "projectType": "basketball",
  "platformCreatedOn": "windows",
  "settings": {},
  "assets": [],
  "sequences": [],
  "basketballContexts": [],
  "brandKits": [],
  "templates": [],
  "proposalSets": [],
  "activeMasterSequenceId": null,
  "compatibility": {
    "minimumReaderVersion": "0.1.0"
  }
}
```

## 5. Schema versioning

- `schemaVersion` is an integer.
- Every nested persistent domain object has its own version where independent evolution is likely.
- The reader checks minimum compatible version before mutation.
- Future unknown fields are preserved where safe.
- Breaking changes require a migration.
- Migrations are one-way unless an explicit downgrade path exists.
- A backup is created before migration.
- A failed migration leaves the original untouched.

## 6. Asset records

```ts
interface ProjectAsset {
  id: string;
  type: "video" | "audio" | "image" | "font" | "graphic" | "caption";
  displayName: string;
  original: AssetLocation;
  managedDerivative?: AssetLocation;
  proxy?: AssetLocation;
  fingerprint: AssetFingerprint;
  inspection: MediaInspectionSummary;
  assignments: string[];
  tags: string[];
  status: "online" | "offline" | "proxy_only" | "invalid";
}
```

### Paths

Store project-relative paths where the file is inside the project.

For linked external files, store:

- Last known absolute path in local-only state
- Portable logical reference
- Fingerprint and metadata for relinking

Do not expose full absolute paths in shared diagnostics or portable packages unless necessary.

## 7. Sequence storage

Phase 1 may store sequence objects inside `project.json` until size or write performance justifies split files.

The schema must permit later decomposition:

```text
sequences/<sequence-id>.json
```

A split-format migration requires an accepted decision and compatibility tests.

## 8. SQLite role

`project.db` may contain:

- Asset search index
- Media inspection cache
- Thumbnail/waveform index
- Job history
- Proposal feature index
- Transcript full-text index
- Operation lookup acceleration

It must not be the sole copy of:

- Timeline objects
- Approved basketball events
- Project identity
- Asset identity
- Brand/template ownership
- Proposal acceptance state

## 9. Operation journal

The journal is append-only NDJSON or an equivalently recoverable format.

Each record includes:

- Operation ID
- Command type/version
- Project/sequence
- Timestamp
- Payload or durable reference
- Result checkpoint
- Group/transaction ID
- Hash or integrity field where appropriate

Rules:

- Append after command validation and coordinated with in-memory apply.
- Mark transaction completion.
- Ignore incomplete trailing records during recovery.
- Compact only after a valid snapshot.
- Preserve enough history for crash recovery, not necessarily unlimited user undo.

## 10. Save algorithm

1. Validate project invariants.
2. Serialise deterministically.
3. Write `project.json.next`.
4. Flush file.
5. Copy or rotate current valid file to recovery snapshot where policy requires.
6. Atomically replace `project.json`.
7. Record checkpoint in journal.
8. Update in-memory save marker.
9. Update derived indexes asynchronously.

A failure before atomic replace must leave the previous file valid.

## 11. Autosave policy

Defaults:

- Journal operations continuously.
- Snapshot after two seconds of inactivity.
- Safety snapshot every 30 seconds during active editing.
- Snapshot before export.
- Snapshot before migration.
- Snapshot before consolidation.
- Snapshot before packaging.

Retention should balance recovery and disk use. The user can configure retention within safe minimums.

## 12. Recovery

On project open:

1. Validate primary manifest.
2. Inspect incomplete journal transactions.
3. Compare autosave checkpoints.
4. Detect a newer valid recovery.
5. Offer:
   - Open primary
   - Recover latest
   - Compare metadata
   - Open recovery as copy
   - Discard recovery

Never overwrite the primary project before the user chooses a recovery outcome.

## 13. Project locking

Opening for write creates a local lock containing:

- Project ID
- Process ID
- Device ID
- Open time
- App version

If a stale lock exists:

- Check whether the owning process is active where possible.
- Offer read-only open, recover, or clear stale lock.
- Do not assume a lock is stale based only on age.

Single-user does not mean concurrent process corruption is acceptable.

## 14. Missing media

An asset is offline when no valid location matches.

Relink order:

1. Existing exact path
2. Project-relative path
3. Stable file identity
4. Full checksum
5. Fast fingerprint
6. Name + size + metadata

Ambiguous candidates require review.

The project may open with offline media. Export is blocked only when the requested range requires unavailable media and no permitted derivative exists.

## 15. Proxy-only operation

A project can edit with a proxy while original is offline.

State is explicit:

- Original online
- Original offline, proxy online
- Managed derivative online
- All representations offline

Final export defaults to originals. The user may explicitly allow a managed derivative or proxy output with a quality warning.

## 16. Brand, fonts, and templates

Project-stored brand assets use relative paths.

Font records include:

- Display family
- File reference
- Fingerprint
- Platform support status
- User acknowledgement of licensing responsibility

A package reports fonts that cannot legally or technically be embedded automatically; it does not infer licensing rights.

## 17. Transcripts and captions

Transcripts may be stored in durable JSON files when large:

```text
transcripts/<transcript-id>.json
```

Required data:

- Language
- Provider metadata without secrets
- Source asset/sequence
- Speaker registry
- Timed tokens/segments
- User corrections
- Generation version

Captions store:

- Source transcript relationship
- Timing
- Text
- Style reference
- Translation relationship
- Approval state

## 18. AI proposal persistence

Proposal records include:

- Proposal ID
- Provider-neutral type
- Source scope
- Source-data version/hash
- Evidence
- Confidence
- Created sequence ID
- Status: proposed/accepted/rejected/modified/stale
- Acceptance command ID

When source events or transcript change, affected proposals may be marked stale rather than silently regenerated.

## 19. Basketball persistence

Persist:

- Game context
- Teams
- Rosters
- Rules
- Events
- Corrections
- Clock anchors
- Explicit overrides

Derive:

- Score at time
- Player points
- Team fouls
- Scorebug view model

See [`basketball-domain.md`](basketball-domain.md).

## 20. Packaging

### Package modes

- Project data only
- Project + used originals
- Project + originals + proxies
- Project + DeX-compatible proxies
- Project + media + fonts + brand

### Preflight report

- Included files
- Excluded files
- Missing files
- Connector-only references
- External fonts
- Estimated size
- Destination space
- Checksums to generate
- Unsupported target-platform assets

### Package format

A package may be a directory or archive. It contains a package manifest with:

- Project schema/version
- File inventory
- Relative destination paths
- Size
- Checksum
- Asset role
- Required/optional flag

Packaging must defend against path traversal and symbolic-link surprises.

## 21. Importing a package

1. Inspect package manifest.
2. Validate paths and checksums.
3. Check schema compatibility.
4. Check storage.
5. Choose destination.
6. Extract to temporary directory.
7. Validate project.
8. Atomically publish project folder.
9. Rebuild disposable indexes.
10. Report missing or incompatible optional assets.

## 22. Consolidation

Consolidate Project can:

- Copy used originals into `media/`
- Copy managed derivatives
- Copy fonts/brand assets
- Repoint asset locations atomically
- Preserve external originals
- Produce a report

A failed consolidation must not leave half-updated asset references.

## 23. Removing unused media

The editor must show:

- Candidate file
- Why it is considered unused
- Whether it is original, managed, proxy, or cache
- Size
- Whether another sequence/template references it

Deleting originals or durable managed media requires explicit confirmation. Cache deletion does not.

## 24. Temp and export files

- Use unique job directories under `temp/`.
- Partial exports do not use the final name.
- Successful validation precedes atomic final move.
- Stale temp cleanup occurs only when no active job owns the files.
- Existing exports require overwrite confirmation.

## 25. Integrity checks

On open and before package:

- Manifest parses and validates
- IDs are unique
- Referenced sequences/assets exist
- Timeline invariants pass
- Nested graph is acyclic
- Basketball references resolve
- Required local files exist or are marked offline
- Recovery/journal state is coherent

## 26. Privacy

Do not store:

- OAuth access tokens in project files
- API keys
- Raw provider credentials
- Unnecessary cloud request payloads
- Secrets in logs

Provider IDs and job metadata may be stored for traceability.

## 27. Example minimal general project

```json
{
  "schemaVersion": 1,
  "projectId": "prj_demo",
  "name": "Demo",
  "projectType": "general",
  "settings": {
    "autosave": true,
    "proxyPolicy": "automatic"
  },
  "assets": [],
  "sequences": [
    {
      "schemaVersion": 1,
      "id": "seq_master",
      "name": "Master",
      "settings": {
        "width": 1920,
        "height": 1080,
        "frameRate": { "numerator": 30, "denominator": 1 },
        "audioSampleRate": 48000
      },
      "tracks": []
    }
  ],
  "activeMasterSequenceId": "seq_master"
}
```

## 28. Migration testing

Every migration requires:

- Old fixture
- Expected new fixture
- Idempotence check where applicable
- Failed migration recovery
- Unknown field preservation
- Save/reopen
- Package/import
- Undo/recovery boundary review
- Minimum-reader-version update

## 29. Deferred decisions

The exact threshold for splitting `project.json` into multiple sequence/transcript files should be based on M2/M3 performance measurements, not preference.
