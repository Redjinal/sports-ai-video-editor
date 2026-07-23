// Direct-URL parsing for the "url" remote source (M11 connectors).
// Deliberately conservative: only http/https is a supported scheme. Note the parsed/rejected
// URL text is never echoed back into the error (it may carry a signed-download token in its
// query string), keeping structured errors free of secrets (AGENTS.md §8).
import { unsupportedUrl } from "./errors";
import type { ConnectorError } from "./errors";

const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

export interface ParsedDirectUrl {
  ok: true;
  /** Normalised (re-serialised) URL. */
  url: string;
  fileName: string;
}

export interface ParsedDirectUrlFailure {
  ok: false;
  error: ConnectorError;
}

export type ParseDirectUrlResult = ParsedDirectUrl | ParsedDirectUrlFailure;

/** Parse and validate a direct download URL. Pure; never throws. */
export function parseDirectUrl(raw: string): ParseDirectUrlResult {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: unsupportedUrl("The URL is empty.") };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: unsupportedUrl("The URL could not be parsed.") };
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    return {
      ok: false,
      error: unsupportedUrl(
        `Unsupported URL scheme "${parsed.protocol}" — only http and https links are allowed.`,
      ),
    };
  }

  if (parsed.hostname.length === 0) {
    return { ok: false, error: unsupportedUrl("The URL is missing a host.") };
  }

  return { ok: true, url: parsed.toString(), fileName: deriveFileName(parsed) };
}

function deriveFileName(url: URL): string {
  const segments = url.pathname.split("/").filter((segment) => segment.length > 0);
  const lastSegment = segments.length > 0 ? segments[segments.length - 1] : undefined;
  if (lastSegment === undefined) {
    return fallbackFileName(url.hostname);
  }
  return decodeSegment(lastSegment);
}

function decodeSegment(segment: string): string {
  try {
    const decoded = decodeURIComponent(segment);
    return decoded.length > 0 ? decoded : segment;
  } catch {
    // Malformed percent-escape in the path segment — fall back to the raw segment
    // rather than failing the whole parse.
    return segment;
  }
}

function fallbackFileName(hostname: string): string {
  return hostname.length > 0 ? `${hostname}-download` : "download";
}
