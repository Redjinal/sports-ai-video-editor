// File-backed project repository (project-format.md §2, §10).
// Layout: <dir>/project.json (authoritative) + operations/ + autosaves/ (created on demand).
import { mkdir, readFile, copyFile, appendFile, access } from "node:fs/promises";
import { join } from "node:path";
import { parseManifest, type ProjectManifest } from "@sve/project-domain";
import { atomicWriteFile, stableStringify } from "./atomic-file";

export interface ProjectRepository {
  save(projectDir: string, manifest: ProjectManifest): Promise<void>;
  load(projectDir: string): Promise<ProjectManifest>;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export class FileProjectRepository implements ProjectRepository {
  async save(projectDir: string, manifest: ProjectManifest): Promise<void> {
    // 1. Validate invariants BEFORE touching the authoritative file.
    const validated = parseManifest(manifest);
    const json = stableStringify(validated);

    const projectFile = join(projectDir, "project.json");
    const opsDir = join(projectDir, "operations");
    const autosaveDir = join(projectDir, "autosaves");
    await mkdir(opsDir, { recursive: true });
    await mkdir(autosaveDir, { recursive: true });

    // 2. Rotate the current valid file into a recovery snapshot before replacing it.
    if (await exists(projectFile)) {
      const stamp = validated.updatedAt.replace(/[:.]/g, "-");
      await copyFile(projectFile, join(autosaveDir, `recovery-${stamp}.json`)).catch(() => {
        // A recovery-copy failure must not block the save; the prior file stays valid.
      });
    }

    // 3. Atomic replace, then 4. record a journal checkpoint.
    await atomicWriteFile(projectFile, json);
    await appendFile(
      join(opsDir, "journal.ndjson"),
      JSON.stringify({ at: validated.updatedAt, event: "save", projectId: validated.projectId }) +
        "\n",
      "utf8",
    );
  }

  async load(projectDir: string): Promise<ProjectManifest> {
    const raw = await readFile(join(projectDir, "project.json"), "utf8");
    return parseManifest(JSON.parse(raw));
  }
}
