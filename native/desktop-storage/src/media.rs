//! Media-side storage: consolidation, cache cleanup, and packaging
//! (project-format.md §20-23). Originals are never mutated or deleted here; only disposable
//! derivatives are removed, and packaging defends against path traversal.

use std::fs;
use std::io::Read;
use std::path::{Component, Path, PathBuf};

use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::error::{Result, StorageError, StorageErrorCode};
use crate::project::{validate_project_dir, PROJECT_FILE};

const MEDIA_DIR: &str = "media";
/// Disposable, rebuildable derivative folders — safe to delete (project-format.md §3).
const CACHE_DIRS: &[&str] = &["proxies", "thumbnails", "waveforms"];
const CACHE_FILES: &[&str] = &["project.db", "project.db-wal", "project.db-shm"];

fn io_err(code: StorageErrorCode, msg: &str, e: std::io::Error) -> StorageError {
    StorageError::new(code, msg).with_cause(e.to_string())
}

/// Reject a filename that could escape the media folder.
fn safe_file_name(source: &Path) -> Result<String> {
    let name = source
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .filter(|n| !n.is_empty() && n != "." && n != "..")
        .ok_or_else(|| {
            StorageError::new(
                StorageErrorCode::StoragePathRejected,
                "A media file has no usable name.",
            )
        })?;
    if name.contains('/') || name.contains('\\') {
        return Err(StorageError::new(
            StorageErrorCode::StoragePathRejected,
            "Invalid media file name.",
        ));
    }
    Ok(name)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsolidatedAsset {
    pub asset_id: String,
    /// New project-relative path under media/.
    pub new_path: String,
}

/// Copy each `(assetId, sourcePath)` original into `<projectDir>/media/`, returning the new
/// paths for the caller to repoint the manifest atomically. All-or-nothing: if any copy fails,
/// the ones already written are removed so no half-consolidated state remains (§22).
pub fn consolidate(dir: &Path, items: &[(String, String)]) -> Result<Vec<ConsolidatedAsset>> {
    let dir = validate_project_dir(dir)?;
    let media = dir.join(MEDIA_DIR);
    fs::create_dir_all(&media).map_err(|e| {
        io_err(
            StorageErrorCode::StorageWriteFailed,
            "Could not create the media folder.",
            e,
        )
    })?;

    let mut written: Vec<PathBuf> = Vec::new();
    let mut out = Vec::new();
    for (asset_id, source_path) in items {
        let source = PathBuf::from(source_path);
        if !source.exists() {
            rollback(&written);
            return Err(StorageError::new(
                StorageErrorCode::StorageReadFailed,
                format!("Source for {asset_id} is offline; consolidation aborted."),
            ));
        }
        // Disambiguate names by prefixing the asset id, keeping the original extension.
        let base = safe_file_name(&source)?;
        let dest = media.join(format!("{}__{}", asset_id, base));
        if let Err(e) = fs::copy(&source, &dest) {
            rollback(&written);
            return Err(io_err(
                StorageErrorCode::StorageWriteFailed,
                "A media file could not be consolidated.",
                e,
            ));
        }
        written.push(dest.clone());
        out.push(ConsolidatedAsset {
            asset_id: asset_id.clone(),
            new_path: format!("{MEDIA_DIR}/{}__{}", asset_id, base),
        });
    }
    Ok(out)
}

fn rollback(written: &[PathBuf]) {
    for p in written {
        let _ = fs::remove_file(p);
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheCleanReport {
    pub removed: Vec<String>,
    pub bytes_freed: u64,
}

fn dir_size(path: &Path) -> u64 {
    let mut total = 0;
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                total += dir_size(&p);
            } else if let Ok(m) = entry.metadata() {
                total += m.len();
            }
        }
    }
    total
}

/// Remove disposable derivative caches. Never touches `media/`, `project.json`, `operations/`,
/// or `autosaves/` — originals and authoritative state are preserved (§23).
pub fn clean_cache(dir: &Path) -> Result<CacheCleanReport> {
    let dir = validate_project_dir(dir)?;
    let mut removed = Vec::new();
    let mut freed = 0u64;
    for name in CACHE_DIRS {
        let p = dir.join(name);
        if p.is_dir() {
            freed += dir_size(&p);
            fs::remove_dir_all(&p).map_err(|e| {
                io_err(
                    StorageErrorCode::StorageWriteFailed,
                    "Could not remove a cache folder.",
                    e,
                )
            })?;
            removed.push((*name).to_string());
        }
    }
    for name in CACHE_FILES {
        let p = dir.join(name);
        if p.is_file() {
            freed += fs::metadata(&p).map(|m| m.len()).unwrap_or(0);
            let _ = fs::remove_file(&p);
            removed.push((*name).to_string());
        }
    }
    Ok(CacheCleanReport {
        removed,
        bytes_freed: freed,
    })
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PackageMode {
    /// Project data only.
    DataOnly,
    /// Project + the consolidated originals under media/.
    WithMedia,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageEntry {
    pub relative_path: String,
    pub size_bytes: u64,
    pub sha256: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageReport {
    pub destination: String,
    pub files: Vec<PackageEntry>,
    pub total_bytes: u64,
}

fn sha256_file(path: &Path) -> Result<String> {
    let mut file = fs::File::open(path).map_err(|e| {
        io_err(
            StorageErrorCode::StorageReadFailed,
            "Could not read a file to package.",
            e,
        )
    })?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 1 << 16];
    loop {
        let n = file.read(&mut buf).map_err(|e| {
            io_err(
                StorageErrorCode::StorageReadFailed,
                "Could not read a file to package.",
                e,
            )
        })?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn contains_parent_dir(path: &Path) -> bool {
    path.components().any(|c| matches!(c, Component::ParentDir))
}

/// Package a project into `dest` (a directory) with a `package.json` manifest of every included
/// file, its size and SHA-256. Path-traversal is rejected (§20). A directory package; archiving
/// is a later addition.
pub fn package_project(dir: &Path, dest: &Path, mode: PackageMode) -> Result<PackageReport> {
    let dir = validate_project_dir(dir)?;
    if !dest.is_absolute() || contains_parent_dir(dest) {
        return Err(StorageError::new(
            StorageErrorCode::StoragePathRejected,
            "The package destination must be an absolute path without '..'.",
        ));
    }
    if !dir.join(PROJECT_FILE).exists() {
        return Err(StorageError::new(
            StorageErrorCode::ProjectNotFound,
            "There is no project to package.",
        ));
    }
    fs::create_dir_all(dest).map_err(|e| {
        io_err(
            StorageErrorCode::StorageWriteFailed,
            "Could not create the package folder.",
            e,
        )
    })?;

    // Gather the files to include.
    let mut sources: Vec<(PathBuf, String)> =
        vec![(dir.join(PROJECT_FILE), PROJECT_FILE.to_string())];
    if mode == PackageMode::WithMedia {
        let media = dir.join(MEDIA_DIR);
        if media.is_dir() {
            for entry in fs::read_dir(&media).map_err(|e| {
                io_err(
                    StorageErrorCode::StorageReadFailed,
                    "Could not read the media folder.",
                    e,
                )
            })? {
                let entry = entry.map_err(|e| {
                    io_err(
                        StorageErrorCode::StorageReadFailed,
                        "Could not read the media folder.",
                        e,
                    )
                })?;
                if entry.path().is_file() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    sources.push((entry.path(), format!("{MEDIA_DIR}/{name}")));
                }
            }
        }
    }

    let mut files = Vec::new();
    let mut total = 0u64;
    for (src, rel) in &sources {
        let target = dest.join(rel);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                io_err(
                    StorageErrorCode::StorageWriteFailed,
                    "Could not create a package subfolder.",
                    e,
                )
            })?;
        }
        fs::copy(src, &target).map_err(|e| {
            io_err(
                StorageErrorCode::StorageWriteFailed,
                "Could not copy a file into the package.",
                e,
            )
        })?;
        let size = fs::metadata(&target).map(|m| m.len()).unwrap_or(0);
        total += size;
        files.push(PackageEntry {
            relative_path: rel.clone(),
            size_bytes: size,
            sha256: sha256_file(&target)?,
        });
    }

    // Package manifest — inventory + checksums (§20).
    let manifest = serde_json::json!({
        "packageVersion": 1,
        "mode": if mode == PackageMode::WithMedia { "with-media" } else { "data-only" },
        "files": files,
        "totalBytes": total,
    });
    fs::write(
        dest.join("package.json"),
        serde_json::to_string_pretty(&manifest).unwrap_or_default(),
    )
    .map_err(|e| {
        io_err(
            StorageErrorCode::StorageWriteFailed,
            "Could not write the package manifest.",
            e,
        )
    })?;

    Ok(PackageReport {
        destination: dest.to_string_lossy().to_string(),
        files,
        total_bytes: total,
    })
}
