# Connector System

> **Status:** Authoritative  
> **Authority:** External media connection, remote browsing, download, localisation, and provider restrictions  
> **Version:** 1.0  
> **Last updated:** 2026-07-22

## 1. Scope

Phase 1 connectors:

- Google Drive
- Dropbox
- OneDrive
- Direct media URL
- YouTube project integration

The editor remains local-first. Remote media must be downloaded to local project storage before timeline editing.

## 2. Core principle

> **Browse remotely; edit locally.**

The timeline never depends on a temporary signed URL, provider session, or remote stream.

## 3. Connector contract

```ts
interface MediaConnector {
  getState(): Promise<ConnectorState>;
  connect(request: ConnectRequest): Promise<ConnectorState>;
  disconnect(): Promise<void>;
  browse(request: BrowseRequest): Promise<RemotePage>;
  search(request: SearchRequest): Promise<RemotePage>;
  inspectAsset(ref: RemoteAssetRef): Promise<RemoteAssetMetadata>;
  downloadAsset(
    ref: RemoteAssetRef,
    destination: LocalDestination,
    options: DownloadOptions
  ): AsyncIterable<DownloadProgress>;
  cancel(jobId: string): Promise<void>;
  refreshCredentials(): Promise<ConnectorState>;
}
```

Provider SDK objects remain inside adapters.

## 4. Connector states

- Not connected
- Connecting
- Connected
- Credentials expired
- Access denied
- Quota limited
- Offline
- Error

Download jobs separately use the shared job state model.

## 5. Remote asset metadata

Normalised fields:

- Provider
- Remote ID
- Display name
- MIME/content type
- Size when available
- Modified time
- Duration/resolution where provider supplies it
- Thumbnail reference
- Download availability
- Ownership/permission summary
- Checksum where available
- Signed URL expiry where applicable

Provider metadata is not trusted as media truth. Local inspection occurs after download.

## 6. Localisation pipeline

```text
Browse/search
→ inspect remote metadata
→ select asset
→ check permission and download availability
→ estimate local storage
→ choose destination
→ download to unique temporary file
→ verify byte count/checksum where available
→ inspect actual media
→ move to project media/managed
→ register project asset
→ generate derivatives
```

An interrupted download never becomes a valid project asset.

## 7. Authentication

- Use provider-supported OAuth or picker flow.
- Store refresh/access tokens in platform secure credential storage.
- Store only non-secret connection references in app settings.
- Request least-privilege scopes practical for browse/download.
- Disconnect revokes local credential access and, where practical, provider grant.
- Expired credentials prompt reauthentication without losing selected project assets already downloaded.

## 8. Google Drive

Phase 1 behaviour:

- Connect account
- Browse/search authorised files
- Select one or more downloadable assets
- Show remote metadata
- Download into project
- Handle provider-native files that are not directly downloadable with an explicit unsupported/export choice
- Refresh expired credentials
- Cancel and retry downloads

Do not edit files in Drive in place.

## 9. Dropbox

Phase 1 behaviour:

- Connect
- Browse/search
- Select assets
- Resolve download
- Download locally
- Handle revoked or expired links
- Cancel/retry
- Keep provider path as provenance metadata

Do not use a temporary shared link as a persistent asset source.

## 10. OneDrive

Phase 1 behaviour:

- Connect
- Browse/search
- Select authorised files
- Download locally
- Handle organisational or personal account permission differences
- Refresh credentials
- Cancel/retry

Provider-specific item IDs remain provenance metadata, not timeline identity.

## 11. Direct URL

Direct URL import supports URLs resolving to downloadable media.

### Preflight

Show:

- Host
- Filename
- Reported content type
- Estimated size
- Redirect destination
- Available disk space
- Project destination

### Reject or require explicit advanced handling for

- Ordinary web pages
- Login-protected resources without a connector
- Unsupported streaming manifests
- Excessive redirect chains
- Disallowed schemes
- Size beyond configured limit or disk space
- Content type inconsistent with downloaded content
- Unsafe local/file URLs
- Private-network targets where policy blocks them

### Security

Direct URL import must protect against:

- Server-side request forgery in any helper service
- Local file access
- Loopback/private network access by default
- DNS rebinding
- Decompression bombs
- Misleading file extensions
- Infinite streams
- Excessive redirects

Because Phase 1 is local, network policy still validates destination and download bounds.

## 12. YouTube project integration

Phase 1 may support:

- Reading authorised video metadata
- Importing title, description, and thumbnail reference
- Attaching the original URL to project notes
- Preparing future publishing metadata
- Opening an authorised management flow
- Registering a local source copy the user already possesses through an authorised method

It must not:

- Download source streams through unofficial mechanisms
- Circumvent access controls
- Treat a public URL as permission to copy
- Promise source-video import where provider terms or APIs do not support it

The UI label should be **YouTube Project Integration**, not **YouTube Downloader**.

## 13. Download destination policy

Default:

```text
<Project>/media/imported/<provider>/
```

Large or unsupported remote assets may be placed in `managed/` after conversion.

File names are sanitised. Collision handling creates a unique name and preserves the provider display name as metadata.

## 14. Progress and cancellation

Progress fields:

- Bytes received
- Total bytes where known
- Transfer rate
- Stage
- Verification state
- Retry count

Cancellation:

- Stops network transfer
- Closes handles
- Removes partial temporary file
- Preserves completed unrelated downloads
- Marks job cancelled

## 15. Retry

Automatic retry is limited to transient errors.

Do not automatically retry:

- Access denied
- Unsupported file
- Insufficient disk
- User cancellation
- Content mismatch
- Security policy rejection

Exponential backoff must be bounded.

## 16. Duplicate detection

Before download, compare:

- Provider remote ID previously imported
- Provider checksum
- File name/size/modified time
- Local asset fingerprint

Offer:

- Reuse existing local asset
- Download new version
- Replace through explicit project command
- Cancel

Never silently replace a project asset.

## 17. Version changes

When a remote file changed after import:

- Existing local asset remains stable.
- Show a newer remote version.
- Download as a new derivative/version only after user action.
- Replacing an asset must preserve timeline mapping or flag incompatibility.

## 18. Offline behaviour

Already-downloaded assets remain usable when offline.

Without network:

- Connector browse/search is unavailable.
- Existing project assets work.
- Queued downloads remain paused/failed with retry.
- The editor must not block project open.

## 19. Errors

Examples:

- `CONNECTOR_NOT_CONNECTED`
- `CONNECTOR_AUTH_EXPIRED`
- `CONNECTOR_ACCESS_DENIED`
- `CONNECTOR_QUOTA_LIMIT`
- `CONNECTOR_REMOTE_NOT_FOUND`
- `CONNECTOR_NOT_DOWNLOADABLE`
- `CONNECTOR_NETWORK`
- `CONNECTOR_DISK_SPACE`
- `CONNECTOR_CONTENT_MISMATCH`
- `CONNECTOR_SECURITY_REJECTED`
- `CONNECTOR_CANCELLED`

Every error includes recovery and data-safety information.

## 20. Logging and privacy

Do not log:

- Tokens
- Signed URLs
- Full remote file lists
- User file contents
- Sensitive query text unless explicitly included in a diagnostic bundle

Log provider, operation, safe remote identifier hash, job ID, status, and error code.

## 21. Tests

Each connector requires:

- Connect/disconnect
- Expired credentials
- Browse pagination
- Search
- Select and download
- Cancellation
- Transient retry
- Access denied
- Quota/rate limit
- Disk-full preflight
- Content mismatch
- Duplicate detection
- Offline project use
- Local media inspection after download

Direct URL additionally requires security test cases. YouTube requires a test that unofficial download behaviour is absent.

## 22. Provider rollout

All five connectors are Phase 1 deliverables, but implementation should use one shared contract and may sequence providers within M11 to validate the abstraction before adding the rest.
