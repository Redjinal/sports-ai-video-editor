// Atomic file write (engineering-standards.md §9, project-format.md §10).
// Write to a unique temp file, flush to disk, then atomically rename over the target.
// A crash before the rename leaves the previous file fully intact.
import { mkdir, open, rename } from "node:fs/promises";
import { dirname } from "node:path";

export async function atomicWriteFile(targetPath: string, data: string): Promise<void> {
  const dir = dirname(targetPath);
  await mkdir(dir, { recursive: true });
  const tmpPath = `${targetPath}.next`;
  const handle = await open(tmpPath, "w");
  try {
    await handle.writeFile(data, "utf8");
    await handle.sync(); // flush to physical storage before the rename
  } finally {
    await handle.close();
  }
  // rename is atomic within a volume: the target is either the old or new file, never partial.
  await rename(tmpPath, targetPath);
}

/** Deterministic JSON serialization: object keys sorted recursively for stable diffs. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value), null, 2);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}
