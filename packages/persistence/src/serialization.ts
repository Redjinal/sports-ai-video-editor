// Pure, platform-neutral serialization helpers (DEC-ARCH-010).
// Deliberately free of `node:fs` so this runs in the webview, in Node, and on Android.

/** Deterministic JSON: object keys sorted recursively, so saves produce stable diffs. */
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
