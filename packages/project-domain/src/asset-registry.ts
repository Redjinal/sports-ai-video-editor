// Asset registry operations on a project manifest (project-format.md §6, §23).
// Pure and platform-neutral: no filesystem, no media libraries. Adding, querying, and
// unused-media review happen here; actual file copies/derivatives live in the native layer.
import type { ProjectAsset, AssetStatus } from "./asset";
import type { ProjectManifest } from "./manifest";

/** Add an asset, de-duplicated by content fingerprint. Returns a new manifest. */
export function addAsset(manifest: ProjectManifest, asset: ProjectAsset): ProjectManifest {
  const existing = manifest.assets.find((a) => a.fingerprint === asset.fingerprint);
  if (existing) {
    // Same content already imported — keep the first, don't duplicate the registry entry.
    return manifest;
  }
  return { ...manifest, assets: [...manifest.assets, asset] };
}

/** Every asset id referenced by a clip on any sequence (nested-sequence objects reference
 *  sequences, not assets, so they are not counted). */
export function referencedAssetIds(manifest: ProjectManifest): Set<string> {
  const ids = new Set<string>();
  for (const seq of manifest.sequences) {
    for (const obj of seq.objects) {
      if (obj.kind === "clip") ids.add(obj.assetId);
    }
  }
  return ids;
}

/** Assets not referenced by any clip — candidates for the unused-media review (§23). */
export function findUnusedAssets(manifest: ProjectManifest): ProjectAsset[] {
  const used = referencedAssetIds(manifest);
  return manifest.assets.filter((a) => !used.has(a.id));
}

/** Set an asset's link status (online/offline/proxy_only/invalid). Returns a new manifest. */
export function setAssetStatus(
  manifest: ProjectManifest,
  assetId: string,
  status: AssetStatus,
): ProjectManifest {
  return {
    ...manifest,
    assets: manifest.assets.map((a) => (a.id === assetId ? { ...a, status } : a)),
  };
}

/** Attach a generated proxy path to an asset. Returns a new manifest. */
export function setAssetProxy(
  manifest: ProjectManifest,
  assetId: string,
  proxyPath: string,
): ProjectManifest {
  return {
    ...manifest,
    assets: manifest.assets.map((a) => (a.id === assetId ? { ...a, proxyPath } : a)),
  };
}

/** Total bytes not needed by any clip, given a size lookup (for the cleanup preflight). */
export function unusedAssetIds(manifest: ProjectManifest): string[] {
  return findUnusedAssets(manifest).map((a) => a.id);
}
