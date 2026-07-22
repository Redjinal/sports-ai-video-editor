// Project Hub + New Project (roadmap M2, product S-01/S-02).
// Lists recent projects from the rebuildable index, and creates/opens/duplicates/deletes.
import { useCallback, useEffect, useState } from "react";
import { createEmptyManifest, type ProjectManifest } from "@sve/project-domain";
import {
  createProject,
  defaultProjectsDir,
  deleteProject,
  describeError,
  duplicateProject,
  openProject,
  recentProjects,
  type RecentProject,
} from "../project/ipc";

interface Props {
  onOpened(dir: string, manifest: ProjectManifest): void;
}

/** Folder-safe name; keeps the user's title but never lets it shape a path. */
function slug(name: string): string {
  return (
    name
      .trim()
      .replace(/[^a-zA-Z0-9-_ ]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 48) || "project"
  );
}

export function ProjectHub({ onOpened }: Props) {
  const [recent, setRecent] = useState<RecentProject[]>([]);
  const [root, setRoot] = useState("");
  const [name, setName] = useState("Untitled project");
  const [projectType, setProjectType] = useState<"general" | "basketball">("general");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<RecentProject | null>(null);

  const refresh = useCallback(async () => {
    try {
      setRecent(await recentProjects(20));
    } catch (e) {
      setError(describeError(e));
    }
  }, []);

  useEffect(() => {
    void defaultProjectsDir()
      .then(setRoot)
      .catch(() => setRoot(""));
    void refresh();
  }, [refresh]);

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = () =>
    guard(async () => {
      const dir = `${root}\\${slug(name)}`;
      const base = createEmptyManifest({
        projectId: `prj_${Date.now()}`,
        name: name.trim() || "Untitled project",
        now: new Date().toISOString(),
        projectType,
      });
      // Every new project starts with one empty master sequence, so the editor always
      // has somewhere to place a clip.
      const manifest: ProjectManifest = {
        ...base,
        sequences: [
          {
            id: "seq_master",
            name: "Master",
            settings: {
              width: 1920,
              height: 1080,
              pixelAspectRatio: { numerator: 1, denominator: 1 },
              frameRate: { numerator: 30, denominator: 1 },
              audioSampleRate: 48_000,
              background: "#000000",
              timeDisplayMode: "timecode",
            },
            tracks: [
              {
                id: "trk_v1",
                name: "V1",
                type: "video",
                order: 0,
                height: 64,
                color: "#334155",
                locked: false,
                hidden: false,
                muted: false,
                solo: false,
                editTargeted: true,
              },
            ],
            objects: [],
            markers: [],
            parentSequenceIds: [],
          },
        ],
        activeMasterSequenceId: "seq_master",
      };
      await createProject(dir, manifest);
      await refresh();
      onOpened(dir, manifest);
    });

  const handleOpen = (p: RecentProject) =>
    guard(async () => {
      const manifest = await openProject(p.path);
      onOpened(p.path, manifest);
    });

  const handleDuplicate = (p: RecentProject) =>
    guard(async () => {
      await duplicateProject(p.path, `${p.path}-copy-${Date.now()}`);
      await refresh();
    });

  const handleDelete = (p: RecentProject) =>
    guard(async () => {
      await deleteProject(p.path, p.projectId);
      setConfirmDelete(null);
      await refresh();
    });

  return (
    <main className="hub">
      <header>
        <h1>Sports AI Video Editor</h1>
        <span className="tag">Project Hub</span>
      </header>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      <section>
        <h2>New project</h2>
        <div className="row">
          <label className="field">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            Type
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value as "general" | "basketball")}
            >
              <option value="general">General</option>
              <option value="basketball">Basketball</option>
            </select>
          </label>
          <button onClick={handleCreate} disabled={busy || !root}>
            Create
          </button>
        </div>
        <p className="muted">
          Will be created in <code>{root || "…"}</code>
        </p>
      </section>

      <section>
        <h2>Recent projects</h2>
        {recent.length === 0 && <p className="muted">No projects yet.</p>}
        <ul className="project-list">
          {recent.map((p) => (
            <li key={p.projectId} className={p.exists ? "" : "is-missing"}>
              <div className="project-main">
                <strong>{p.name}</strong>
                <span className="muted">{p.path}</span>
              </div>
              {!p.exists && <span className="badge bad">Folder missing</span>}
              <div className="row">
                <button onClick={() => handleOpen(p)} disabled={busy || !p.exists}>
                  Open
                </button>
                <button onClick={() => handleDuplicate(p)} disabled={busy || !p.exists}>
                  Duplicate
                </button>
                <button
                  className="danger"
                  onClick={() => setConfirmDelete(p)}
                  disabled={busy || !p.exists}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {confirmDelete && (
        // Destructive actions are never hidden behind a generic control (AGENTS.md §8).
        <div className="confirm" role="alertdialog" aria-labelledby="confirm-title">
          <h2 id="confirm-title">Delete “{confirmDelete.name}”?</h2>
          <p>
            This permanently removes the project folder <code>{confirmDelete.path}</code> and
            everything in it. Source media stored elsewhere is not affected. This cannot be undone.
          </p>
          <div className="row">
            <button className="danger" onClick={() => handleDelete(confirmDelete)} disabled={busy}>
              Delete permanently
            </button>
            <button onClick={() => setConfirmDelete(null)} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
