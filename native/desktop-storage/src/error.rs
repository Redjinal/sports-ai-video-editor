//! Structured project/storage errors (technical-architecture.md §20).

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum StorageErrorCode {
    #[serde(rename = "PROJECT_NOT_FOUND")]
    ProjectNotFound,
    #[serde(rename = "PROJECT_INVALID")]
    ProjectInvalid,
    #[serde(rename = "PROJECT_SCHEMA_TOO_NEW")]
    ProjectSchemaTooNew,
    #[serde(rename = "PROJECT_ALREADY_EXISTS")]
    ProjectAlreadyExists,
    #[serde(rename = "PROJECT_LOCKED")]
    ProjectLocked,
    #[serde(rename = "STORAGE_WRITE_FAILED")]
    StorageWriteFailed,
    #[serde(rename = "STORAGE_READ_FAILED")]
    StorageReadFailed,
    #[serde(rename = "STORAGE_PATH_REJECTED")]
    StoragePathRejected,
    #[serde(rename = "STORAGE_INDEX_FAILED")]
    StorageIndexFailed,
}

/// Boundary error shape. Mirrors the media adapter so the UI handles both identically.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageError {
    pub code: StorageErrorCode,
    pub safe_message: String,
    pub technical_cause: Option<String>,
    pub retryable: bool,
    /// Whether existing on-disk project data is still intact after this failure.
    pub data_safe: bool,
}

impl StorageError {
    pub fn new(code: StorageErrorCode, safe_message: impl Into<String>) -> Self {
        Self {
            code,
            safe_message: safe_message.into(),
            technical_cause: None,
            retryable: false,
            data_safe: true,
        }
    }

    pub fn with_cause(mut self, cause: impl Into<String>) -> Self {
        self.technical_cause = Some(cause.into());
        self
    }

    /// Mark a failure that may have left on-disk data in an uncertain state.
    pub fn data_at_risk(mut self) -> Self {
        self.data_safe = false;
        self
    }
}

impl std::fmt::Display for StorageError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}: {}", self.code, self.safe_message)
    }
}

impl std::error::Error for StorageError {}

pub type Result<T> = std::result::Result<T, StorageError>;
