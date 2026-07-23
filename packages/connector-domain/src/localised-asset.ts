// Localisation result (M11 connectors).
// Once a remote source has been downloaded, the resulting asset is self-contained: it is
// resolved purely from `localPath` going forward. `provenance` is retained for display/audit
// only — it is never required (or used) to re-resolve the asset — so the project never
// carries a *permanent* remote dependency (AGENTS.md §8: local-first).
import type { RemoteSource, RemoteSourceProvider } from "./remote-source";

export interface LocalizedAssetProvenance {
  provider: RemoteSourceProvider;
  sourceDisplayName: string;
  /** ISO-8601 timestamp of when localisation completed. */
  localisedAtIso: string;
}

export interface LocalizedAsset {
  /** Local filesystem path — the sole thing needed to resolve this asset from now on. */
  localPath: string;
  provenance: LocalizedAssetProvenance;
}

/** Build the self-contained localisation result for a completed download. Pure. */
export function localise(
  source: RemoteSource,
  localPath: string,
  localisedAtIso: string,
): LocalizedAsset {
  return {
    localPath,
    provenance: {
      provider: source.provider,
      sourceDisplayName: source.displayName,
      localisedAtIso,
    },
  };
}

/** True once an asset has a usable local path — the only thing that makes it "localized". */
export function isLocalized(asset: LocalizedAsset): boolean {
  return asset.localPath.length > 0;
}
