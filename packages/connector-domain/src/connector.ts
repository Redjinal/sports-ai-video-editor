// Provider-neutral connector interface (M11 connectors).
// This is a contract only — concrete adapters (Google Drive, Dropbox, OneDrive, generic
// URL fetchers, ...) implement it later as separately-approved work. This package must
// never import a real provider SDK, perform network I/O, or depend on any concrete
// transport; every method returns a Promise of a structured result, never a bare throw.
import type { ConnectorError } from "./errors";
import type { DownloadJob } from "./download-job";
import type { RemoteSource, RemoteSourceProvider } from "./remote-source";

export interface ConnectorEntry {
  source: RemoteSource;
  /** True for folders/containers that can be listed further; false for a leaf file. */
  isContainer: boolean;
}

export type ConnectorListResult =
  { ok: true; entries: ConnectorEntry[] } | { ok: false; error: ConnectorError };

export type ConnectorMetadataResult =
  { ok: true; source: RemoteSource } | { ok: false; error: ConnectorError };

export type ConnectorDownloadRequestResult =
  { ok: true; job: DownloadJob } | { ok: false; error: ConnectorError };

/**
 * Provider-neutral connector surface. `list`/`fetchMetadata`/`requestDownload` are the
 * only operations a connector exposes to the rest of the app; `requestDownload` hands back
 * a `DownloadJob` descriptor rather than bytes — actual transfer, progress reporting, and
 * localisation are driven by the caller through the pure helpers in `download-job.ts` and
 * `localised-asset.ts`.
 */
export interface Connector {
  readonly provider: RemoteSourceProvider;
  /** List entries under a container (folder); omit `containerId` to list the root. */
  list(containerId?: string): Promise<ConnectorListResult>;
  fetchMetadata(source: RemoteSource): Promise<ConnectorMetadataResult>;
  requestDownload(
    source: RemoteSource,
    targetLocalPath: string,
  ): Promise<ConnectorDownloadRequestResult>;
}
