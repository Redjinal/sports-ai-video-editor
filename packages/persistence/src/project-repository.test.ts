import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEmptyManifest, type ProjectManifest } from "@sve/project-domain";
import { FileProjectRepository } from "./project-repository";

let dir: string;
const repo = new FileProjectRepository();

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "sve-proj-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function manifest(name: string, updatedAt: string): ProjectManifest {
  return createEmptyManifest({ projectId: "prj_1", name, now: updatedAt });
}

describe("FileProjectRepository", () => {
  it("saves and reopens a project without losing state", async () => {
    const m = manifest("Home vs Away", "2026-07-22T00:00:00.000Z");
    await repo.save(dir, m);
    const reopened = await repo.load(dir);
    expect(reopened).toEqual(m);
  });

  it("keeps a recovery snapshot of the prior valid file on the next save", async () => {
    await repo.save(dir, manifest("v1", "2026-07-22T00:00:00.000Z"));
    await repo.save(dir, manifest("v2", "2026-07-22T00:00:01.000Z"));
    const snapshots = await readdir(join(dir, "autosaves"));
    expect(snapshots.length).toBeGreaterThanOrEqual(1);
    // The rotated snapshot holds the previous ("v1") content.
    const snap = await readFile(join(dir, "autosaves", snapshots[0]!), "utf8");
    expect(snap).toContain('"v1"');
  });

  it("leaves the previous file valid when a save fails validation", async () => {
    await repo.save(dir, manifest("good", "2026-07-22T00:00:00.000Z"));
    // A structurally invalid manifest must be rejected before the atomic replace.
    const broken = { ...manifest("bad", "2026-07-22T00:00:02.000Z"), projectId: "" };
    await expect(repo.save(dir, broken as ProjectManifest)).rejects.toBeTruthy();
    const reopened = await repo.load(dir);
    expect(reopened.name).toBe("good");
  });

  it("writes no leftover .next temp file after a successful save", async () => {
    await repo.save(dir, manifest("v1", "2026-07-22T00:00:00.000Z"));
    const files = await readdir(dir);
    expect(files.some((f) => f.endsWith(".next"))).toBe(false);
    expect(files).toContain("project.json");
  });
});
