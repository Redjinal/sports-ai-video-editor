//! Project storage IPC surface (roadmap M2).
//!
//! Thin, versioned wrappers over `desktop-storage`. All path handling and atomic-write
//! logic stays in the native crate; these commands only marshal and keep the local index
//! in step with what actually happened on disk.

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use desktop_storage::error::{StorageError, StorageErrorCode};
use desktop_storage::index::{ProjectIndex, RecentProject};
use desktop_storage::media_links::{self, AssetLink};
use desktop_storage::project::{self, RecoverySnapshot};
use serde_json::Value;
use tauri::{Manager, State};

/// The SQLite index is derived data; if it cannot be opened we fall back to an in-memory
/// one so a broken index never blocks opening real projects.
pub struct IndexState(pub Mutex<ProjectIndex>);

pub fn build_index(app: &tauri::AppHandle) -> ProjectIndex {
    let path = app
        .path()
        .app_data_dir()
        .map(|d| d.join("index.sqlite"))
        .unwrap_or_else(|_| PathBuf::from("index.sqlite"));
    match ProjectIndex::open(&path) {
        Ok(index) => index,
        Err(e) => {
            eprintln!("local index unavailable ({e}); continuing with an in-memory index");
            match ProjectIndex::in_memory() {
                Ok(index) => index,
                Err(inner) => {
                    // An in-memory SQLite failure means the process is in real trouble.
                    panic!("could not create an in-memory project index: {inner}")
                }
            }
        }
    }
}

fn epoch_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Record a project in the recent list. Index failures are logged, never fatal.
fn touch_index(index: &State<'_, IndexState>, dir: &Path, manifest: &Value) {
    let Ok(guard) = index.0.lock() else { return };
    let get = |k: &str| manifest.get(k).and_then(Value::as_str).unwrap_or_default();
    if let Err(e) = guard.upsert(
        get("projectId"),
        get("name"),
        &dir.to_string_lossy(),
        get("projectType"),
        get("updatedAt"),
        epoch_millis(),
    ) {
        eprintln!("could not update the project index: {e}");
    }
}

#[tauri::command]
pub fn default_projects_dir(app: tauri::AppHandle) -> String {
    app.path()
        .document_dir()
        .map(|d| d.join("Sports AI Video Editor"))
        .unwrap_or_else(|_| PathBuf::from("."))
        .to_string_lossy()
        .to_string()
}

#[tauri::command]
pub fn project_create(
    index: State<'_, IndexState>,
    dir: String,
    manifest: Value,
) -> Result<(), StorageError> {
    let path = PathBuf::from(&dir);
    project::create(&path, &manifest)?;
    touch_index(&index, &path, &manifest);
    Ok(())
}

#[tauri::command]
pub fn project_open(index: State<'_, IndexState>, dir: String) -> Result<Value, StorageError> {
    let path = PathBuf::from(&dir);
    let manifest = project::open(&path)?;
    touch_index(&index, &path, &manifest);
    Ok(manifest)
}

#[tauri::command]
pub fn project_save(
    index: State<'_, IndexState>,
    dir: String,
    manifest: Value,
) -> Result<(), StorageError> {
    let path = PathBuf::from(&dir);
    project::save(&path, &manifest)?;
    touch_index(&index, &path, &manifest);
    Ok(())
}

#[tauri::command]
pub fn project_duplicate(
    index: State<'_, IndexState>,
    src: String,
    dest: String,
) -> Result<Value, StorageError> {
    let dest_path = PathBuf::from(&dest);
    project::duplicate(Path::new(&src), &dest_path)?;
    // The copy keeps the source project id; give it a fresh identity so the two are
    // distinct entries rather than one overwriting the other in the recent list.
    let mut manifest = project::open(&dest_path)?;
    if let Some(obj) = manifest.as_object_mut() {
        obj.insert(
            "projectId".into(),
            Value::String(format!("prj_{}", epoch_millis())),
        );
        let name = obj
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("Project")
            .to_string();
        obj.insert("name".into(), Value::String(format!("{name} copy")));
    }
    project::save(&dest_path, &manifest)?;
    touch_index(&index, &dest_path, &manifest);
    Ok(manifest)
}

#[tauri::command]
pub fn project_delete(
    index: State<'_, IndexState>,
    dir: String,
    project_id: String,
) -> Result<(), StorageError> {
    project::delete(Path::new(&dir))?;
    if let Ok(guard) = index.0.lock() {
        let _ = guard.remove(&project_id);
    }
    Ok(())
}

#[tauri::command]
pub fn project_recovery_snapshots(dir: String) -> Result<Vec<RecoverySnapshot>, StorageError> {
    project::list_recovery_snapshots(Path::new(&dir))
}

#[tauri::command]
pub fn project_recover_as_copy(
    index: State<'_, IndexState>,
    dir: String,
    snapshot: String,
    dest: String,
) -> Result<Value, StorageError> {
    let dest_path = PathBuf::from(&dest);
    project::recover_as_copy(Path::new(&dir), &snapshot, &dest_path)?;
    let manifest = project::open(&dest_path)?;
    touch_index(&index, &dest_path, &manifest);
    Ok(manifest)
}

#[tauri::command]
pub fn project_detect_links(manifest: Value) -> Vec<AssetLink> {
    media_links::detect(&manifest)
}

#[tauri::command]
pub fn project_relink(
    manifest: Value,
    asset_id: String,
    new_path: String,
) -> Result<Value, StorageError> {
    media_links::relink(&manifest, &asset_id, &new_path)
}

#[tauri::command]
pub fn recent_projects(
    index: State<'_, IndexState>,
    limit: u32,
) -> Result<Vec<RecentProject>, StorageError> {
    let guard = index.0.lock().map_err(|_| {
        StorageError::new(
            StorageErrorCode::StorageIndexFailed,
            "The local index is unavailable.",
        )
    })?;
    guard.recent(limit)
}
