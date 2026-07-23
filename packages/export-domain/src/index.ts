// @sve/export-domain — platform-neutral export settings, per-platform capability matrix and
// fallback, export output validation (an existing file is not proof of a successful export),
// caption descriptors, and the M12 certification matrix.
// No FFmpeg/Media3/native/Tauri/React/SQLite imports (structure.md §7) — this package describes
// and validates exports, it never runs one.
export * from "./settings";
export * from "./capability-matrix";
export * from "./validation";
export * from "./captions";
export * from "./certification";
