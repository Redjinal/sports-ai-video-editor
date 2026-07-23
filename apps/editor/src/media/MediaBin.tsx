// Media bin (roadmap M4): import media, review the asset registry with compatibility and link
// status, generate proxies, review unused media, and run consolidate / cache-clean / package.
// All editing arithmetic and file work lives in the domain and native layers; this wires them.
import { useCallback, useMemo, useState } from "react";
import {
  addAsset,
  findUnusedAssets,
  removeAsset,
  setAssetProxy,
  type ProjectAsset,
  type ProjectManifest,
} from "@sve/project-domain";
import { ingestMedia, type MediaInspector } from "@sve/application-services";
import { ticksToSeconds, asTicks } from "@sve/timeline-domain";
import { inspectMedia, generateProxy } from "../ipc";
import { cleanCache, consolidate, packageProject } from "../project/media-ipc";

interface MediaBinProps {
  manifest: ProjectManifest;
  dir: string;
  onManifestChange: (m: ProjectManifest) => void;
  onError: (message: string) => void;
  /** Offer to relink an offline asset (handled by the shell's relink dialog). */
  onRelink?: (asset: ProjectAsset) => void;
}

const inspector: MediaInspector = { inspect: (req) => inspectMedia(req.path) };

function baseName(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

function fmtDur(ticks: number): string {
  const s = ticksToSeconds(asTicks(Math.max(0, Math.round(ticks))));
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export function MediaBin({ manifest, dir, onManifestChange, onError, onRelink }: MediaBinProps) {
  const [importPath, setImportPath] = useState("");
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [compat, setCompat] = useState<Record<string, string>>({});

  const assets = manifest.assets as ProjectAsset[];
  const unused = useMemo(() => new Set(findUnusedAssets(manifest).map((a) => a.id)), [manifest]);
  const shown = useMemo(
    () => assets.filter((a) => baseName(a.path).toLowerCase().includes(filter.toLowerCase())),
    [assets, filter],
  );

  const guard = useCallback(
    async (label: string, fn: () => Promise<void>) => {
      setBusy(label);
      try {
        await fn();
      } catch (e) {
        onError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
      }
    },
    [onError],
  );

  const doImport = () =>
    guard("Importing", async () => {
      const { asset, inspection } = await ingestMedia(inspector, importPath.trim());
      setCompat((c) => ({ ...c, [asset.id]: inspection.compatibility }));
      onManifestChange(addAsset(manifest, asset));
      setImportPath("");
    });

  const doProxy = (asset: ProjectAsset) =>
    guard("Proxy", async () => {
      const out = `${asset.path}.proxy720.mp4`;
      const path = await generateProxy({
        jobId: crypto.randomUUID(),
        sourcePath: asset.path,
        outputPath: out,
        maxWidth: 1280,
        maxHeight: 720,
        totalTicks: asset.durationTicks,
      });
      onManifestChange(setAssetProxy(manifest, asset.id, path));
    });

  const doRemove = (asset: ProjectAsset) => {
    try {
      onManifestChange(removeAsset(manifest, asset.id));
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };

  const doConsolidate = () =>
    guard("Consolidating", async () => {
      const items = assets.map((a) => ({ assetId: a.id, sourcePath: a.path }));
      const mapping = await consolidate(dir, items);
      // Repoint each asset to its new project-relative location.
      const byId = new Map(mapping.map((m) => [m.assetId, m.newPath]));
      onManifestChange({
        ...manifest,
        assets: assets.map((a) =>
          byId.has(a.id) ? { ...a, path: `${dir}\\${byId.get(a.id)!.replace(/\//g, "\\")}` } : a,
        ),
        updatedAt: new Date().toISOString(),
      });
    });

  const doCleanCache = () =>
    guard("Cleaning", async () => {
      const report = await cleanCache(dir);
      onError(
        `Freed ${(report.bytesFreed / 1_048_576).toFixed(1)} MB from ${report.removed.length} caches.`,
      );
    });

  const doPackage = () =>
    guard("Packaging", async () => {
      const report = await packageProject(dir, `${dir}-package`, true);
      onError(
        `Packaged ${report.files.length} files (${(report.totalBytes / 1_048_576).toFixed(1)} MB) to ${report.destination}.`,
      );
    });

  return (
    <div className="stack" aria-label="Media bin">
      <div className="row">
        <input
          aria-label="Media file path"
          placeholder="Full path to a media file"
          value={importPath}
          onChange={(e) => setImportPath(e.target.value)}
        />
        <button onClick={doImport} disabled={!importPath.trim() || busy !== null}>
          Import
        </button>
      </div>

      <input
        aria-label="Filter media"
        placeholder="Filter…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      <h3>Assets ({assets.length})</h3>
      {shown.length === 0 && <p className="muted">No media imported yet.</p>}
      <ul className="link-list">
        {shown.map((a) => (
          <li key={a.id} className={unused.has(a.id) ? "is-unused" : ""}>
            <span className={`badge ${a.status === "online" ? "good" : "warn"}`}>{a.kind}</span>
            <span className="wrap" style={{ flex: 1 }}>
              {baseName(a.path)}
              <span className="muted mono"> · {fmtDur(a.durationTicks)}</span>
            </span>
            {compat[a.id] && (
              <span className={`badge ${compat[a.id] === "certified" ? "good" : "warn"}`}>
                {compat[a.id]}
              </span>
            )}
            {a.proxyPath && <span className="badge good">proxy</span>}
            {unused.has(a.id) && <span className="badge warn">unused</span>}
            <button onClick={() => doProxy(a)} disabled={busy !== null}>
              Proxy
            </button>
            {a.status !== "online" && onRelink && (
              <button onClick={() => onRelink(a)}>Relink…</button>
            )}
            {unused.has(a.id) && (
              <button className="danger" onClick={() => doRemove(a)}>
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      <h3>Project media</h3>
      <div className="row">
        <button onClick={doConsolidate} disabled={busy !== null || assets.length === 0}>
          Consolidate
        </button>
        <button onClick={doCleanCache} disabled={busy !== null}>
          Clean cache
        </button>
        <button onClick={doPackage} disabled={busy !== null}>
          Package…
        </button>
      </div>
      {busy && <p className="muted">{busy}…</p>}
      <p className="hint">
        Consolidation copies originals into the project and never deletes the source. Cleaning
        removes only disposable proxies and thumbnails. Unused media can be reviewed and removed,
        but not while a clip still references it.
      </p>
    </div>
  );
}
