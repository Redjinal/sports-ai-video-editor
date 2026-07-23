// Structured connector errors (AGENTS.md §8 — never swallow errors; every boundary
// failure becomes a structured result of { code, message (safe), recovery }, never a
// bare thrown string).

export const CONNECTOR_ERROR_CODES = [
  "CONNECTOR_AUTH_FAILED",
  "CONNECTOR_NETWORK",
  "CONNECTOR_NOT_FOUND",
  "CONNECTOR_UNSUPPORTED_URL",
  "CONNECTOR_INVALID_STATE",
] as const;

export type ConnectorErrorCode = (typeof CONNECTOR_ERROR_CODES)[number];

export interface ConnectorError {
  code: ConnectorErrorCode;
  /** Safe, user-presentable summary. Never a token, credential, or raw provider payload. */
  message: string;
  /** Suggested next step, e.g. "Reconnect the account and try again." */
  recovery: string;
  /** Technical detail for logs/diagnostics only; callers must never put secrets here. */
  technicalCause?: string;
}

/** Base factory — every specific error below funnels through this so the shape is uniform. */
export function createConnectorError(
  code: ConnectorErrorCode,
  message: string,
  recovery: string,
  technicalCause?: string,
): ConnectorError {
  return technicalCause === undefined
    ? { code, message, recovery }
    : { code, message, recovery, technicalCause };
}

export function authFailed(
  message = "Authentication with the provider failed.",
  technicalCause?: string,
): ConnectorError {
  return createConnectorError(
    "CONNECTOR_AUTH_FAILED",
    message,
    "Reconnect the account and try again.",
    technicalCause,
  );
}

export function networkError(
  message = "A network error occurred while talking to the provider.",
  technicalCause?: string,
): ConnectorError {
  return createConnectorError(
    "CONNECTOR_NETWORK",
    message,
    "Check the connection and retry.",
    technicalCause,
  );
}

export function notFound(
  message = "The requested item could not be found.",
  technicalCause?: string,
): ConnectorError {
  return createConnectorError(
    "CONNECTOR_NOT_FOUND",
    message,
    "Confirm the item still exists and try again.",
    technicalCause,
  );
}

export function unsupportedUrl(
  message = "This URL is not supported.",
  technicalCause?: string,
): ConnectorError {
  return createConnectorError(
    "CONNECTOR_UNSUPPORTED_URL",
    message,
    "Use a direct http:// or https:// link and try again.",
    technicalCause,
  );
}

export function invalidState(
  message: string,
  recovery = "Wait for the current operation to finish, or reset the connector.",
): ConnectorError {
  return createConnectorError("CONNECTOR_INVALID_STATE", message, recovery);
}
