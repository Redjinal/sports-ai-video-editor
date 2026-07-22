// Media/export error taxonomy (media-engine.md §24, technical-architecture.md §20).
// Codes are provider- and platform-neutral; user-facing copy is resolved in the UI layer.

export const MEDIA_ERROR_CODES = [
  "MEDIA_UNREADABLE",
  "MEDIA_UNSUPPORTED_CODEC",
  "MEDIA_PROXY_FAILED",
  "MEDIA_PROXY_MAPPING_INVALID",
  "MEDIA_INSPECT_FAILED",
] as const;

export const EXPORT_ERROR_CODES = [
  "EXPORT_INVALID_PLAN",
  "EXPORT_SOURCE_OFFLINE",
  "EXPORT_ENCODER_FAILED",
  "EXPORT_VALIDATION_FAILED",
  "EXPORT_CANCELLED",
] as const;

export type MediaErrorCode = (typeof MEDIA_ERROR_CODES)[number];
export type ExportErrorCode = (typeof EXPORT_ERROR_CODES)[number];
export type MediaEngineErrorCode = MediaErrorCode | ExportErrorCode;

/**
 * Structured boundary error (engineering-standards.md §7). Never swallow errors;
 * every failure becomes one of these with an actionable, safe message.
 */
export interface MediaEngineError {
  code: MediaEngineErrorCode;
  /** Safe, user-presentable summary. No stack traces, tokens, or raw shell output. */
  safeMessage: string;
  /** Technical cause for logs/diagnostics only. */
  technicalCause?: string;
  retryable: boolean;
  /** Whether user data (source media, project) remains safe after this failure. */
  dataSafe: boolean;
  /** Correlation/job id for tracing across the IPC boundary. */
  jobId?: string;
}
