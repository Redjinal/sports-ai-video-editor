// Top-level routing: Project Hub until a project is open, then the editor shell.
import { useState } from "react";
import type { ProjectManifest } from "@sve/project-domain";
import { ProjectHub } from "./screens/ProjectHub";
import { EditorShell } from "./screens/EditorShell";

interface OpenProject {
  dir: string;
  manifest: ProjectManifest;
}

export default function App() {
  const [open, setOpen] = useState<OpenProject | null>(null);

  if (!open) {
    return <ProjectHub onOpened={(dir, manifest) => setOpen({ dir, manifest })} />;
  }
  return (
    <EditorShell
      key={open.dir}
      dir={open.dir}
      manifest={open.manifest}
      onClose={() => setOpen(null)}
    />
  );
}
