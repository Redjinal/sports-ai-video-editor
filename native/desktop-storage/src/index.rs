//! Local SQLite index (technical-architecture.md §13, DEC-ARCH-008).
//!
//! This database is **disposable**. It holds only derived, rebuildable data — the recent
//! project list and cached headline metadata. Authoritative project truth is always
//! `project.json`. Deleting this file must never make a project unrecoverable, so every
//! read path tolerates a missing or stale row and re-derives from disk.

use rusqlite::{params, Connection};
use serde::Serialize;
use std::path::Path;

use crate::error::{Result, StorageError, StorageErrorCode};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentProject {
    pub project_id: String,
    pub name: String,
    pub path: String,
    pub project_type: String,
    pub updated_at: String,
    pub last_opened_at: i64,
    /// False when the project folder has since been moved or deleted.
    pub exists: bool,
}

fn db_err(msg: &str, e: rusqlite::Error) -> StorageError {
    StorageError::new(StorageErrorCode::StorageIndexFailed, msg).with_cause(e.to_string())
}

pub struct ProjectIndex {
    conn: Connection,
}

impl ProjectIndex {
    /// Open (creating if needed) the index at `path`.
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| {
                StorageError::new(
                    StorageErrorCode::StorageIndexFailed,
                    "Could not create the index folder.",
                )
                .with_cause(e.to_string())
            })?;
        }
        let conn =
            Connection::open(path).map_err(|e| db_err("Could not open the local index.", e))?;
        let index = Self { conn };
        index.migrate()?;
        Ok(index)
    }

    /// In-memory index, used by tests and as a fallback if the on-disk index is unusable.
    pub fn in_memory() -> Result<Self> {
        let conn =
            Connection::open_in_memory().map_err(|e| db_err("Could not open the index.", e))?;
        let index = Self { conn };
        index.migrate()?;
        Ok(index)
    }

    fn migrate(&self) -> Result<()> {
        self.conn
            .execute_batch(
                "PRAGMA journal_mode=WAL;
                 CREATE TABLE IF NOT EXISTS projects (
                     project_id     TEXT PRIMARY KEY,
                     name           TEXT NOT NULL,
                     path           TEXT NOT NULL UNIQUE,
                     project_type   TEXT NOT NULL DEFAULT 'general',
                     updated_at     TEXT NOT NULL DEFAULT '',
                     last_opened_at INTEGER NOT NULL DEFAULT 0
                 );
                 CREATE INDEX IF NOT EXISTS idx_projects_recent
                     ON projects(last_opened_at DESC);",
            )
            .map_err(|e| db_err("Could not prepare the local index.", e))
    }

    /// Record or refresh a project entry. Keyed by path so a moved project re-registers
    /// rather than duplicating.
    pub fn upsert(
        &self,
        project_id: &str,
        name: &str,
        path: &str,
        project_type: &str,
        updated_at: &str,
        last_opened_at: i64,
    ) -> Result<()> {
        self.conn
            .execute(
                "INSERT INTO projects (project_id, name, path, project_type, updated_at, last_opened_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(project_id) DO UPDATE SET
                     name=excluded.name, path=excluded.path, project_type=excluded.project_type,
                     updated_at=excluded.updated_at, last_opened_at=excluded.last_opened_at",
                params![project_id, name, path, project_type, updated_at, last_opened_at],
            )
            .map(|_| ())
            .map_err(|e| db_err("Could not record the project in the local index.", e))
    }

    /// Recent projects, newest first. Each row is checked against the filesystem so the hub
    /// can show a moved/deleted project instead of failing to open it later.
    pub fn recent(&self, limit: u32) -> Result<Vec<RecentProject>> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT project_id, name, path, project_type, updated_at, last_opened_at
                 FROM projects ORDER BY last_opened_at DESC LIMIT ?1",
            )
            .map_err(|e| db_err("Could not read the local index.", e))?;

        let rows = stmt
            .query_map(params![limit], |row| {
                let path: String = row.get(2)?;
                Ok(RecentProject {
                    project_id: row.get(0)?,
                    name: row.get(1)?,
                    exists: Path::new(&path).join(super::project::PROJECT_FILE).exists(),
                    path,
                    project_type: row.get(3)?,
                    updated_at: row.get(4)?,
                    last_opened_at: row.get(5)?,
                })
            })
            .map_err(|e| db_err("Could not read the local index.", e))?;

        let mut out = Vec::new();
        for row in rows {
            out.push(row.map_err(|e| db_err("Could not read a project index row.", e))?);
        }
        Ok(out)
    }

    pub fn remove(&self, project_id: &str) -> Result<()> {
        self.conn
            .execute(
                "DELETE FROM projects WHERE project_id = ?1",
                params![project_id],
            )
            .map(|_| ())
            .map_err(|e| db_err("Could not update the local index.", e))
    }

    /// Drop every row. The index is derived data, so this is always safe.
    pub fn clear(&self) -> Result<()> {
        self.conn
            .execute("DELETE FROM projects", [])
            .map(|_| ())
            .map_err(|e| db_err("Could not clear the local index.", e))
    }
}
