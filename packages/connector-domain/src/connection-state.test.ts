import { describe, it, expect } from "vitest";
import { transition } from "./connection-state";
import type { ConnectionEvent, ConnectionState } from "./connection-state";

describe("connection state machine", () => {
  it("connects: disconnected --connect--> connecting --success--> connected", () => {
    const a = transition("disconnected", "connect");
    expect(a).toEqual({ state: "connecting" });
    const b = transition(a.state, "success");
    expect(b).toEqual({ state: "connected" });
  });

  it("a failed connection attempt goes to error", () => {
    const a = transition("connecting", "fail");
    expect(a).toEqual({ state: "error" });
  });

  it("a connected session can drop to error", () => {
    const a = transition("connected", "fail");
    expect(a).toEqual({ state: "error" });
  });

  it("disconnect resets to disconnected from every state", () => {
    const states: ConnectionState[] = [
      "disconnected",
      "connecting",
      "connected",
      "error",
      "recovering",
    ];
    for (const state of states) {
      expect(transition(state, "disconnect")).toEqual({ state: "disconnected" });
    }
  });

  it("recovers: error --retry--> recovering --success--> connected", () => {
    const a = transition("error", "retry");
    expect(a).toEqual({ state: "recovering" });
    const b = transition(a.state, "success");
    expect(b).toEqual({ state: "connected" });
  });

  it("a failed recovery attempt returns to error for another retry", () => {
    const a = transition("error", "retry");
    const b = transition(a.state, "fail");
    expect(b).toEqual({ state: "error" });
    // and can be retried again
    const c = transition(b.state, "retry");
    expect(c).toEqual({ state: "recovering" });
  });

  it("illegal transitions return the same state plus a structured error", () => {
    const illegalPairs: Array<[ConnectionState, ConnectionEvent]> = [
      ["disconnected", "success"],
      ["disconnected", "fail"],
      ["disconnected", "retry"],
      ["connecting", "connect"],
      ["connecting", "retry"],
      ["connected", "connect"],
      ["connected", "success"],
      ["connected", "retry"],
      ["error", "connect"],
      ["error", "success"],
      ["recovering", "connect"],
      ["recovering", "retry"],
    ];

    for (const [state, event] of illegalPairs) {
      const result = transition(state, event);
      expect(result.state).toBe(state);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe("CONNECTOR_INVALID_STATE");
      expect(result.error?.recovery.length).toBeGreaterThan(0);
    }
  });

  it("disconnect from disconnected is a legal no-op, not an illegal transition", () => {
    const result = transition("disconnected", "disconnect");
    expect(result).toEqual({ state: "disconnected" });
    expect(result.error).toBeUndefined();
  });

  it("is deterministic: same (state, event) always yields the same result", () => {
    const r1 = transition("connecting", "success");
    const r2 = transition("connecting", "success");
    expect(r1).toEqual(r2);
  });
});
