//! Project file operations (project-format.md §2, §10).
//!
//! This is the authoritative implementation for the desktop app: the webview has no
//! filesystem access, so every create/open/save/duplicate/delete goes through here.
//!
//! Division of responsibility: TypeScript owns the *domain* schema (zod) and validates the
//! manifest before it is sent. Rust owns *storage* invariants — path containment, atomic
//! replace, recovery rotation, journal checkpoints — and only checks the minimal structure
//! it needs (`schemaVersion`, `projectId`) so normative rules are not duplicated.

use std::fs::{self, File};
use std::io::Write;
use std::path::{Component, Path, PathBuf};

use serde::Serialize;
use serde_json::Value;

use crate::error::{Result, StorageError, StorageErrorCode};

pub const PROJECT_FILE: &str = "project.json";
pub const OPERATIONS_DIR: &str = "operations";
pub const AUTOSAVES_DIR: &str = "autosaves";
pub const JOURNAL_FILE: &str = "journal.ndjson";
pub const LOCK_FILE: &str = "project.lock";
/// Rolling recovery snapshots retained per project (technical-architecture.md §14).
pub const MAX_RECOVERY_SNAPSHOTS: usize = 10;
/// Highest manifest schema this build can safely open.
pub const SUPPORTED_SCHEMA_VERSION: u64 = 1;

fn io_err(code: StorageErrorCode, msg: &str, e: std::io::Error) -> StorageError {
    StorageError::new(code, msg).with_cause(e.to_string())
}

/// Reject relative paths and anything containing `..`, so a caller cannot escape upward.
pub fn validate_project_dir(dir: &Path) -> Result<PathBuf> {
    if !dir.is_absolute() {
        return Err(StorageError::new(
            StorageErrorCode::StoragePathRejected,
            "The project location must be an absolute path.",
        ));
    }
    if dir.components().any(|c| matches!(c, Component::ParentDir)) {
        return Err(StorageError::new(
            StorageErrorCode::StoragePathRejected,
            "The project location may not contain '..'.",
        ));
    }
    Ok(dir.to_path_buf())
}

pub fn project_file(dir: &Path) -> PathBuf {
    dir.join(PROJECT_FILE)
}

/// Minimal structural check. Domain validation is TypeScript's job.
fn check_structure(manifest: &Value) -> Result<u64> {
    let schema_version = manifest
        .get("schemaVersion")
        .and_then(Value::as_u64)
        .ok_or_else(|| {
            StorageError::new(
                StorageErrorCode::ProjectInvalid,
                "The project file is missing a schema version.",
            )
        })?;
    let project_id = manifest
        .get("projectId")
        .and_then(Value::as_str)
        .unwrap_or("");
    if project_id.is_empty() {
        return Err(StorageError::new(
            StorageErrorCode::ProjectInvalid,
            "The project file is missing a project id.",
        ));
    }
    Ok(schema_version)
}

/// Serialise deterministically. `serde_json::Map` is a BTreeMap here, so keys are ordered.
fn serialise(manifest: &Value) -> Result<String> {
    serde_json::to_string_pretty(manifest).map_err(|e| {
        StorageError::new(
            StorageErrorCode::StorageWriteFailed,
            "The project could not be serialised.",
        )
        .with_cause(e.to_string())
    })
}

/// Write to a temp file, flush to disk, then atomically rename over the target.
fn atomic_write(target: &Path, contents: &str) -> Result<()> {
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            io_err(
                StorageErrorCode::StorageWriteFailed,
                "Could not create the project folder.",
                e,
            )
        })?;
    }
    let tmp = target.with_file_name(format!(
        ".{}.next",
        target
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "project".into())
    ));
    {
        let mut file = File::create(&tmp).map_err(|e| {
            io_err(
                StorageErrorCode::StorageWriteFailed,
                "Could not open the project file for writing.",
                e,
            )
        })?;
        file.write_all(contents.as_bytes()).map_err(|e| {
            io_err(
                StorageErrorCode::StorageWriteFailed,
                "Could not write the project file.",
                e,
            )
        })?;
        // Flush before the rename so a crash cannot leave a half-written replacement.
        file.sync_all().map_err(|e| {
            io_err(
                StorageErrorCode::StorageWriteFailed,
                "Could not flush the project file to disk.",
                e,
            )
        })?;
    }
    fs::rename(&tmp, target).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        io_err(
            StorageErrorCode::StorageWriteFailed,
            "Could not finalise the project file.",
            e,
        )
    })
}

fn ensure_layout(dir: &Path) -> Result<()> {
    for sub in [OPERATIONS_DIR, AUTOSAVES_DIR] {
        fs::create_dir_all(dir.join(sub)).map_err(|e| {
            io_err(
                StorageErrorCode::StorageWriteFailed,
                "Could not create the project folder layout.",
                e,
            )
        })?;
    }
    Ok(())
}

fn append_journal(dir: &Path, event: &str, detail: &str) -> Result<()> {
    let path = dir.join(OPERATIONS_DIR).join(JOURNAL_FILE);
    let line = serde_json::json!({ "at": now_stamp(), "event": event, "detail": detail });
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| {
            io_err(
                StorageErrorCode::StorageWriteFailed,
                "Could not open the project journal.",
                e,
            )
        })?;
    writeln!(file, "{line}").map_err(|e| {
        io_err(
            StorageErrorCode::StorageWriteFailed,
            "Could not append to the project journal.",
            e,
        )
    })
}

/// Filename-safe UTC-ish stamp derived from the system clock.
fn now_stamp() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    format!("{secs}")
}

/// Keep only the newest `MAX_RECOVERY_SNAPSHOTS` snapshots.
fn prune_snapshots(dir: &Path) -> Result<()> {
    let mut snaps = list_recovery_snapshots(dir)?;
    if snaps.len() <= MAX_RECOVERY_SNAPSHOTS {
        return Ok(());
    }
    // list_recovery_snapshots returns newest-first; drop the tail.
    for old in snaps.split_off(MAX_RECOVERY_SNAPSHOTS) {
        let _ = fs::remove_file(dir.join(AUTOSAVES_DIR).join(old.file_name));
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoverySnapshot {
    pub file_name: String,
    pub stamp: String,
    pub size_bytes: u64,
}

/// Newest first.
pub fn list_recovery_snapshots(dir: &Path) -> Result<Vec<RecoverySnapshot>> {
    let autosaves = dir.join(AUTOSAVES_DIR);
    if !autosaves.exists() {
        return Ok(Vec::new());
    }
    let entries = fs::read_dir(&autosaves).map_err(|e| {
        io_err(
            StorageErrorCode::StorageReadFailed,
            "Could not read the recovery folder.",
            e,
        )
    })?;
    let mut out = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if !name.starts_with("recovery-") || !name.ends_with(".json") {
            continue;
        }
        let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
        let stamp = name
            .trim_start_matches("recovery-")
            .trim_end_matches(".json")
            .to_string();
        out.push(RecoverySnapshot {
            file_name: name,
            stamp,
            size_bytes: size,
        });
    }
    // Stamps are millisecond integers, so lexicographic-by-length then value works; sort
    // numerically to stay correct across digit-count changes.
    out.sort_by(|a, b| {
        let av = a.stamp.parse::<u128>().unwrap_or(0);
        let bv = b.stamp.parse::<u128>().unwrap_or(0);
        bv.cmp(&av)
    });
    Ok(out)
}

/// Create a new project directory with an initial manifest.
pub fn create(dir: &Path, manifest: &Value) -> Result<()> {
    let dir = validate_project_dir(dir)?;
    check_structure(manifest)?;
    if project_file(&dir).exists() {
        return Err(StorageError::new(
            StorageErrorCode::ProjectAlreadyExists,
            "A project already exists in that folder.",
        ));
    }
    ensure_layout(&dir)?;
    atomic_write(&project_file(&dir), &serialise(manifest)?)?;
    append_journal(&dir, "create", "")?;
    Ok(())
}

/// Read and structurally validate a project manifest.
pub fn open(dir: &Path) -> Result<Value> {
    let dir = validate_project_dir(dir)?;
    let path = project_file(&dir);
    if !path.exists() {
        return Err(StorageError::new(
            StorageErrorCode::ProjectNotFound,
            "No project was found in that folder.",
        ));
    }
    let raw = fs::read_to_string(&path).map_err(|e| {
        io_err(
            StorageErrorCode::StorageReadFailed,
            "The project file could not be read.",
            e,
        )
    })?;
    let manifest: Value = serde_json::from_str(&raw).map_err(|e| {
        StorageError::new(
            StorageErrorCode::ProjectInvalid,
            "The project file is not valid JSON.",
        )
        .with_cause(e.to_string())
    })?;
    let version = check_structure(&manifest)?;
    if version > SUPPORTED_SCHEMA_VERSION {
        return Err(StorageError::new(
            StorageErrorCode::ProjectSchemaTooNew,
            "This project was created by a newer version of the app.",
        ));
    }
    Ok(manifest)
}

/// Atomic save with recovery rotation (project-format.md §10).
/// A failure before the atomic replace leaves the previous file valid.
pub fn save(dir: &Path, manifest: &Value) -> Result<()> {
    let dir = validate_project_dir(dir)?;
    check_structure(manifest)?;
    let contents = serialise(manifest)?;
    ensure_layout(&dir)?;

    let target = project_file(&dir);
    if target.exists() {
        let snapshot = dir
            .join(AUTOSAVES_DIR)
            .join(format!("recovery-{}.json", now_stamp()));
        // A failed snapshot must not block the save; the prior file is still intact.
        let _ = fs::copy(&target, &snapshot);
        let _ = prune_snapshots(&dir);
    }

    atomic_write(&target, &contents)?;
    append_journal(&dir, "save", "")?;
    Ok(())
}

/// Restore a recovery snapshot into a NEW project folder, never over the original
/// (project-format.md: recovery opens as a copy).
pub fn recover_as_copy(dir: &Path, snapshot_file: &str, dest: &Path) -> Result<()> {
    let dir = validate_project_dir(dir)?;
    let dest = validate_project_dir(dest)?;
    if snapshot_file.contains('/') || snapshot_file.contains('\\') {
        return Err(StorageError::new(
            StorageErrorCode::StoragePathRejected,
            "Invalid recovery snapshot name.",
        ));
    }
    let snapshot = dir.join(AUTOSAVES_DIR).join(snapshot_file);
    if !snapshot.exists() {
        return Err(StorageError::new(
            StorageErrorCode::ProjectNotFound,
            "That recovery snapshot no longer exists.",
        ));
    }
    if project_file(&dest).exists() {
        return Err(StorageError::new(
            StorageErrorCode::ProjectAlreadyExists,
            "A project already exists at the recovery destination.",
        ));
    }
    let raw = fs::read_to_string(&snapshot).map_err(|e| {
        io_err(
            StorageErrorCode::StorageReadFailed,
            "The recovery snapshot could not be read.",
            e,
        )
    })?;
    let manifest: Value = serde_json::from_str(&raw).map_err(|e| {
        StorageError::new(
            StorageErrorCode::ProjectInvalid,
            "The recovery snapshot is not valid JSON.",
        )
        .with_cause(e.to_string())
    })?;
    check_structure(&manifest)?;
    ensure_layout(&dest)?;
    atomic_write(&project_file(&dest), &serialise(&manifest)?)?;
    append_journal(&dest, "recover", snapshot_file)?;
    Ok(())
}

/// Copy a project to a new folder. Derived caches are not copied — they rebuild.
pub fn duplicate(src: &Path, dest: &Path) -> Result<()> {
    let src = validate_project_dir(src)?;
    let dest = validate_project_dir(dest)?;
    if !project_file(&src).exists() {
        return Err(StorageError::new(
            StorageErrorCode::ProjectNotFound,
            "There is no project to duplicate.",
        ));
    }
    if project_file(&dest).exists() {
        return Err(StorageError::new(
            StorageErrorCode::ProjectAlreadyExists,
            "A project already exists at the destination.",
        ));
    }
    ensure_layout(&dest)?;
    fs::copy(project_file(&src), project_file(&dest)).map_err(|e| {
        io_err(
            StorageErrorCode::StorageWriteFailed,
            "The project could not be duplicated.",
            e,
        )
    })?;
    append_journal(&dest, "duplicate", &src.to_string_lossy())?;
    Ok(())
}

/// Delete a project folder. Refuses anything that is not actually a project, so a bad
/// path cannot be turned into a recursive delete of arbitrary user data.
pub fn delete(dir: &Path) -> Result<()> {
    let dir = validate_project_dir(dir)?;
    if !project_file(&dir).exists() {
        return Err(StorageError::new(
            StorageErrorCode::ProjectNotFound,
            "That folder does not contain a project.",
        ));
    }
    fs::remove_dir_all(&dir).map_err(|e| {
        io_err(
            StorageErrorCode::StorageWriteFailed,
            "The project could not be deleted.",
            e,
        )
        .data_at_risk()
    })
}
