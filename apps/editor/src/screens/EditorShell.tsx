// Editor shell (roadmap M2): resizable/collapsible panels, save state, autosave,
// missing-media detection with relink, and recovery snapshots.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createAutosaveScheduler, type AutosaveScheduler } from "@sve/application-services";
import type { ProjectManifest } from "@sve/project-domain";
import { PanelGroup, type PanelSpec } from "../shell/PanelGroup";
import { Timeline } from "../timeline/Timeline";
import type { Sequence } from "@sve/timeline-domain";
import {
  describeError,
  detectLinks,
  recoverAsCopy,
  recoverySnapshots,
  relinkAsset,
  saveProject,
  type AssetLink,
  type RecoverySnapshot,
} from "../project/ipc";

interface Props {
  dir: string;
  manifest: ProjectManifest;
  onClose(): void;
}

const LAYOUT_KEY = "sve.shell.layout";

/** Workspace layout is transient convenience state, never project truth. */
function loadLayout<T>(suffix: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${LAYOUT_KEY}.${suffix}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveLayout(suffix: string, value: unknown): void {
  try {
    localStorage.setItem(`${LAYOUT_KEY}.${suffix}`, JSON.stringify(value));
  } catch {
    // A full or blocked storage quota must never break editing.
  }
}

export function EditorShell({ dir, manifest: initial, onClose }: Props) {
  const [manifest, setManifest] = useState<ProjectManifest>(initial);
  const [links, setLinks] = useState<AssetLink[]>([]);
  const [snapshots, setSnapshots] = useState<RecoverySnapshot[]>([]);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const [error, setError] = useState<string | null>(null);
  const [relinkTarget, setRelinkTarget] = useState<AssetLink | null>(null);
  const [relinkPath, setRelinkPath] = useState("");

  const [sizes, setSizes] = useState<Record<string, number>>(() =>
    loadLayout("sizes", { project: 22, workspace: 56, inspector: 22 }),
  );
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    loadLayout("collapsed", {}),
  );

  // Keep the latest manifest available to the autosave closure without re-creating it.
  const manifestRef = useRef(manifest);
  manifestRef.current = manifest;
  const schedulerRef = useRef<AutosaveScheduler | null>(null);

  useEffect(() => {
    const scheduler = createAutosaveScheduler({
      save: async () => {
        setSaveState("saving");
        await saveProject(dir, manifestRef.current);
        setSaveState("saved");
      },
      onError: (e) => {
        setSaveState("error");
        setError(describeError(e));
      },
    });
    schedulerRef.current = scheduler;
    return () => {
      // Flush before tearing down so pending edits are not lost on unmount.
      void scheduler.flush().finally(() => scheduler.dispose());
    };
  }, [dir]);

  const markDirty = useCallback((next: ProjectManifest) => {
    setManifest(next);
    manifestRef.current = next;
    setSaveState("unsaved");
    schedulerRef.current?.markDirty();
  }, []);

  // The manifest schema (zod-inferred) types optionals as `| undefined`, which
  // exactOptionalPropertyTypes won't assign to the hand-written Sequence — the runtime shape
  // is identical (validated by parseManifest), so cast at this boundary.
  const sequences = manifest.sequences ?? [];
  const activeSequence = (sequences.find((s) => s.id === manifest.activeMasterSequenceId) ??
    sequences[0]) as Sequence | undefined;

  // A timeline edit updates the active sequence in the manifest and schedules an autosave.
  const handleSequenceChange = useCallback(
    (seq: Sequence) => {
      const current = manifestRef.current;
      markDirty({
        ...current,
        sequences: (current.sequences ?? []).map((s) => (s.id === seq.id ? seq : s)),
        updatedAt: new Date().toISOString(),
      });
    },
    [markDirty],
  );

  const refreshLinks = useCallback(async () => {
    try {
      setLinks(await detectLinks(manifestRef.current));
      setSnapshots(await recoverySnapshots(dir));
    } catch (e) {
      setError(describeError(e));
    }
  }, [dir]);

  useEffect(() => {
    void refreshLinks();
  }, [refreshLinks]);

  useEffect(() => saveLayout("sizes", sizes), [sizes]);
  useEffect(() => saveLayout("collapsed", collapsed), [collapsed]);

  const saveNow = async () => {
    try {
      setSaveState("saving");
      await saveProject(dir, manifestRef.current);
      setSaveState("saved");
      await refreshLinks();
    } catch (e) {
      setSaveState("error");
      setError(describeError(e));
    }
  };

  const closeProject = async () => {
    // Closing is a risky operation: flush first (technical-architecture.md §14).
    await schedulerRef.current?.flush();
    onClose();
  };

  const doRelink = async () => {
    if (!relinkTarget) return;
    try {
      const next = await relinkAsset(manifestRef.current, relinkTarget.assetId, relinkPath);
      markDirty(next);
      setRelinkTarget(null);
      setRelinkPath("");
      await refreshLinks();
    } catch (e) {
      setError(describeError(e));
    }
  };

  const doRecover = async (snapshot: RecoverySnapshot) => {
    try {
      await recoverAsCopy(dir, snapshot.fileName, `${dir}-recovered-${snapshot.stamp}`);
      setError(null);
      await refreshLinks();
    } catch (e) {
      setError(describeError(e));
    }
  };

  const offline = links.filter((l) => l.status === "offline" || l.status === "invalid");

  const panels: PanelSpec[] = useMemo(
    () => [
      {
        id: "project",
        title: "Project",
        defaultSize: 22,
        minSize: 12,
        content: (
          <div className="stack">
            <dl className="facts">
              <div>
                <dt>Name</dt>
                <dd>{manifest.name}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{manifest.projectType}</dd>
              </div>
              <div>
                <dt>Schema</dt>
                <dd>v{manifest.schemaVersion}</dd>
              </div>
              <div>
                <dt>Folder</dt>
                <dd className="wrap">{dir}</dd>
              </div>
            </dl>
            <h3>Media links</h3>
            {links.length === 0 && <p className="muted">No assets yet.</p>}
            <ul className="link-list">
              {links.map((l) => (
                <li key={l.assetId}>
                  <span className={`badge ${l.status === "online" ? "good" : "warn"}`}>
                    {l.status}
                  </span>
                  <span className="wrap muted">{l.path}</span>
                  {(l.status === "offline" || l.status === "invalid") && (
                    <button onClick={() => setRelinkTarget(l)}>Relink…</button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ),
      },
      {
        id: "workspace",
        title: "Timeline",
        defaultSize: 56,
        minSize: 30,
        collapsible: false,
        content: activeSequence ? (
          <Timeline
            key={dir}
            sequence={activeSequence}
            onChange={handleSequenceChange}
            onError={setError}
          />
        ) : (
          <div className="empty-inspector">This project has no sequence yet.</div>
        ),
      },
      {
        id: "inspector",
        title: "Recovery",
        defaultSize: 22,
        minSize: 12,
        content: (
          <div className="stack">
            <p className="muted">
              Snapshots are taken automatically. Recovering always opens a copy — your current
              project is never overwritten.
            </p>
            {snapshots.length === 0 && <p className="muted">No snapshots yet.</p>}
            <ul className="link-list">
              {snapshots.slice(0, 8).map((s) => (
                <li key={s.fileName}>
                  <span className="muted">{new Date(Number(s.stamp)).toLocaleString()}</span>
                  <button onClick={() => void doRecover(s)}>Recover a copy</button>
                </li>
              ))}
            </ul>
          </div>
        ),
      },
    ],
    // Panels rebuild whenever the data they render changes.
    [manifest, links, snapshots, dir, activeSequence, handleSequenceChange],
  );

  return (
    <div className="shell">
      <header className="shell-bar">
        <strong>{manifest.name}</strong>
        <span className={`save-state is-${saveState}`}>
          {saveState === "saved" && "All changes saved"}
          {saveState === "saving" && "Saving…"}
          {saveState === "unsaved" && "Unsaved changes"}
          {saveState === "error" && "Save failed"}
        </span>
        {offline.length > 0 && (
          <span className="badge bad">
            {offline.length} missing {offline.length === 1 ? "file" : "files"}
          </span>
        )}
        <div className="spacer" />
        <button onClick={() => void saveNow()}>Save</button>
        <button onClick={() => void closeProject()}>Close project</button>
      </header>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      <PanelGroup
        direction="horizontal"
        panels={panels}
        sizes={sizes}
        collapsed={collapsed}
        onSizesChange={setSizes}
        onCollapsedChange={setCollapsed}
      />

      {relinkTarget && (
        <div className="confirm" role="dialog" aria-labelledby="relink-title">
          <h2 id="relink-title">Relink “{relinkTarget.assetId}”</h2>
          <p className="muted">
            Original location: <code className="wrap">{relinkTarget.path}</code>
          </p>
          <label className="field">
            New file path
            <input value={relinkPath} onChange={(e) => setRelinkPath(e.target.value)} />
          </label>
          <div className="row">
            <button onClick={() => void doRelink()} disabled={!relinkPath}>
              Relink
            </button>
            <button
              onClick={() => {
                setRelinkTarget(null);
                setRelinkPath("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
