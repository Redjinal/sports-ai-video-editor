import { describe, it, expect } from "vitest";
import { parseDirectUrl } from "./url";

describe("parseDirectUrl", () => {
  it("accepts a valid https URL and extracts the filename", () => {
    const result = parseDirectUrl("https://cdn.example.com/videos/game-1.mp4");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fileName).toBe("game-1.mp4");
      expect(result.url).toBe("https://cdn.example.com/videos/game-1.mp4");
    }
  });

  it("accepts a valid http URL", () => {
    const result = parseDirectUrl("http://example.com/clip.mov");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fileName).toBe("clip.mov");
    }
  });

  it("decodes a percent-encoded filename", () => {
    const result = parseDirectUrl("https://example.com/videos/game%20one.mp4");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fileName).toBe("game one.mp4");
    }
  });

  it("falls back to a hostname-derived filename when the path has no segments", () => {
    const result = parseDirectUrl("https://example.com");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fileName).toBe("example.com-download");
    }
  });

  it("rejects an unsafe scheme", () => {
    const result = parseDirectUrl("javascript:alert(1)");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONNECTOR_UNSUPPORTED_URL");
    }
  });

  it("rejects a file:// scheme", () => {
    const result = parseDirectUrl("file:///etc/passwd");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONNECTOR_UNSUPPORTED_URL");
    }
  });

  it("rejects a data: scheme", () => {
    const result = parseDirectUrl("data:text/plain;base64,aGVsbG8=");
    expect(result.ok).toBe(false);
  });

  it("rejects malformed input", () => {
    const result = parseDirectUrl("not a url at all");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONNECTOR_UNSUPPORTED_URL");
      expect(result.error.recovery.length).toBeGreaterThan(0);
    }
  });

  it("rejects an empty string", () => {
    const result = parseDirectUrl("   ");
    expect(result.ok).toBe(false);
  });

  it("never echoes the raw input back into the error (may carry a token)", () => {
    const secretUrl = "https://example.com/x?token=super-secret-value";
    const result = parseDirectUrl(`javascript:${secretUrl}`);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).not.toContain("super-secret-value");
      expect(result.error.technicalCause ?? "").not.toContain("super-secret-value");
    }
  });
});
