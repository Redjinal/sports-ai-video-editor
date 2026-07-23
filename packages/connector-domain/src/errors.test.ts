import { describe, it, expect } from "vitest";
import {
  createConnectorError,
  authFailed,
  networkError,
  notFound,
  unsupportedUrl,
  invalidState,
  CONNECTOR_ERROR_CODES,
} from "./errors";

describe("ConnectorError factories", () => {
  it("every factory returns a code + safe message + recovery", () => {
    const errors = [
      authFailed(),
      networkError(),
      notFound(),
      unsupportedUrl(),
      invalidState("bad state"),
    ];
    for (const error of errors) {
      expect(CONNECTOR_ERROR_CODES).toContain(error.code);
      expect(typeof error.message).toBe("string");
      expect(error.message.length).toBeGreaterThan(0);
      expect(typeof error.recovery).toBe("string");
      expect(error.recovery.length).toBeGreaterThan(0);
    }
  });

  it("attaches technicalCause only when provided (never a bare undefined property)", () => {
    const withCause = authFailed("failed", "token expired at provider");
    expect(withCause.technicalCause).toBe("token expired at provider");

    const withoutCause = authFailed();
    expect("technicalCause" in withoutCause).toBe(false);
  });

  it("createConnectorError is the uniform base for every specific code", () => {
    const error = createConnectorError(
      "CONNECTOR_NOT_FOUND",
      "The file was not found.",
      "Check the file still exists.",
    );
    expect(error).toEqual({
      code: "CONNECTOR_NOT_FOUND",
      message: "The file was not found.",
      recovery: "Check the file still exists.",
    });
  });

  it("carries the specific code for each factory", () => {
    expect(authFailed().code).toBe("CONNECTOR_AUTH_FAILED");
    expect(networkError().code).toBe("CONNECTOR_NETWORK");
    expect(notFound().code).toBe("CONNECTOR_NOT_FOUND");
    expect(unsupportedUrl().code).toBe("CONNECTOR_UNSUPPORTED_URL");
    expect(invalidState("x").code).toBe("CONNECTOR_INVALID_STATE");
  });
});
