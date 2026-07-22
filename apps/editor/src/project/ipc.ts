// Project storage IPC bindings.
// Manifests crossing this boundary are validated with the project-domain zod schema —
// native output is untrusted input, and a malformed manifest must fail loudly here rather
// than corrupt in-memory state.
import { invoke } from "@tauri-apps/api/core";
import { parseManifest, type ProjectManifest } from "@sve/project-domain";

export interface RecentProject {
  projectId: string;
  name: string;
  path: string;
  projectType: string;
  updatedAt: string;
  lastOpenedAt: number;
  /** False when the folder has been moved or deleted since it was last opened. */
  exists: boolean;
}

export interface RecoverySnapshot {
  fileName: string;
  stamp: string;
  sizeBytes: number;
}

export type LinkStatus = "online" | "offline" | "proxy_only" | "invalid";

export interface AssetLink {
  assetId: string;
  path: string;
  status: LinkStatus;
  proxyPath?: string;
}

/** Storage errors arrive as a structured payload, not a bare string. */
export interface StorageError {
  code: string;
  safeMessage: string;
  technicalCause?: string;
  retryable: boolean;
  dataSafe: boolean;
}

export function isStorageError(value: unknown): value is StorageError {
  return typeof value === "object" && value !== null && "code" in value && "safeMessage" in value;
}

/** Turn any thrown value into something safe to show a user. */
export function describeError(error: unknown): string {
  if (isStorageError(error)) return error.safeMessage;
  if (error instanceof Error) return error.message;
  return String(error);
}

export function defaultProjectsDir(): Promise<string> {
  return invoke<string>("default_projects_dir");
}

export async function createProject(dir: string, manifest: ProjectManifest): Promise<void> {
  await invoke("project_create", { dir, manifest });
}

export async function openProject(dir: string): Promise<ProjectManifest> {
  return parseManifest(await invoke<unknown>("project_open", { dir }));
}

export async function saveProject(dir: string, manifest: ProjectManifest): Promise<void> {
  await invoke("project_save", { dir, manifest });
}

export async function duplicateProject(src: string, dest: string): Promise<ProjectManifest> {
  return parseManifest(await invoke<unknown>("project_duplicate", { src, dest }));
}

export async function deleteProject(dir: string, projectId: string): Promise<void> {
  await invoke("project_delete", { dir, projectId });
}

export function recoverySnapshots(dir: string): Promise<RecoverySnapshot[]> {
  return invoke<RecoverySnapshot[]>("project_recovery_snapshots", { dir });
}

export async function recoverAsCopy(
  dir: string,
  snapshot: string,
  dest: string,
): Promise<ProjectManifest> {
  return parseManifest(await invoke<unknown>("project_recover_as_copy", { dir, snapshot, dest }));
}

export function detectLinks(manifest: ProjectManifest): Promise<AssetLink[]> {
  return invoke<AssetLink[]>("project_detect_links", { manifest });
}

export async function relinkAsset(
  manifest: ProjectManifest,
  assetId: string,
  newPath: string,
): Promise<ProjectManifest> {
  return parseManifest(await invoke<unknown>("project_relink", { manifest, assetId, newPath }));
}

export function recentProjects(limit = 20): Promise<RecentProject[]> {
  return invoke<RecentProject[]>("recent_projects", { limit });
}
