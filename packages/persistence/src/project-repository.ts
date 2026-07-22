// Project repository contract (DEC-ARCH-010).
//
// This package deliberately contains NO filesystem implementation. The webview has no
// filesystem access, so authoritative project I/O lives in `native/desktop-storage` and is
// tested there against real files. Keeping a second `node:fs` implementation here would
// mean the test suite validated code the app never executes.
//
// Application services depend on this interface; the Tauri IPC adapter in `apps/editor`
// implements it.
import type { ProjectManifest } from "@sve/project-domain";

export interface ProjectRepository {
  create(projectDir: string, manifest: ProjectManifest): Promise<void>;
  open(projectDir: string): Promise<ProjectManifest>;
  save(projectDir: string, manifest: ProjectManifest): Promise<void>;
  duplicate(sourceDir: string, destinationDir: string): Promise<ProjectManifest>;
  delete(projectDir: string, projectId: string): Promise<void>;
}

/** Recovery snapshot metadata as reported by the native storage layer. */
export interface RecoverySnapshot {
  fileName: string;
  stamp: string;
  sizeBytes: number;
}
