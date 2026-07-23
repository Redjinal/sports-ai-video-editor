//! Windows desktop storage adapter for the Sports-Aware AI Video Editor.
//!
//! Owns safe path handling, atomic project writes, recovery snapshots, missing-media
//! detection/relinking, and the rebuildable SQLite index (structure.md §6).
//!
//! The webview has no filesystem access, so this crate is the authoritative implementation
//! of project file operations for the desktop app.

pub mod error;
pub mod index;
pub mod media;
pub mod media_links;
pub mod project;
