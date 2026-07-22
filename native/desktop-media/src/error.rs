//! Structured media errors mirroring the `@sve/media-contracts` taxonomy.
//! Native code never surfaces raw shell output or stack traces to the UI.

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum MediaErrorCode {
    #[serde(rename = "MEDIA_UNREADABLE")]
    MediaUnreadable,
    #[serde(rename = "MEDIA_UNSUPPORTED_CODEC")]
    MediaUnsupportedCodec,
    #[serde(rename = "MEDIA_INSPECT_FAILED")]
    MediaInspectFailed,
    #[serde(rename = "MEDIA_PROXY_FAILED")]
    MediaProxyFailed,
    #[serde(rename = "EXPORT_INVALID_PLAN")]
    ExportInvalidPlan,
    #[serde(rename = "EXPORT_SOURCE_OFFLINE")]
    ExportSourceOffline,
    #[serde(rename = "EXPORT_ENCODER_FAILED")]
    ExportEncoderFailed,
    #[serde(rename = "EXPORT_VALIDATION_FAILED")]
    ExportValidationFailed,
    #[serde(rename = "EXPORT_CANCELLED")]
    ExportCancelled,
}

/// Error shape crossing the IPC boundary (engineering-standards.md §7).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaError {
    pub code: MediaErrorCode,
    /// Safe, user-presentable summary.
    pub safe_message: String,
    /// Technical detail for local logs/diagnostics only.
    pub technical_cause: Option<String>,
    pub retryable: bool,
    /// Whether user data remains safe after this failure.
    pub data_safe: bool,
    pub job_id: Option<String>,
}

impl MediaError {
    pub fn new(code: MediaErrorCode, safe_message: impl Into<String>) -> Self {
        Self {
            code,
            safe_message: safe_message.into(),
            technical_cause: None,
            retryable: false,
            data_safe: true,
            job_id: None,
        }
    }

    pub fn with_cause(mut self, cause: impl Into<String>) -> Self {
        self.technical_cause = Some(cause.into());
        self
    }

    pub fn retryable(mut self) -> Self {
        self.retryable = true;
        self
    }

    pub fn with_job(mut self, job_id: impl Into<String>) -> Self {
        self.job_id = Some(job_id.into());
        self
    }
}

impl std::fmt::Display for MediaError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}: {}", self.code, self.safe_message)
    }
}

impl std::error::Error for MediaError {}

pub type Result<T> = std::result::Result<T, MediaError>;
