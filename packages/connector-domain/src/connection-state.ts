// Connector connection state machine (M11 connectors).
// Pure and deterministic: `transition` never mutates its input and always returns a result,
// never throws. Illegal transitions return the *same* state plus a structured error so
// callers can surface it without a try/catch (AGENTS.md §8).
import { invalidState } from "./errors";
import type { ConnectorError } from "./errors";

export const CONNECTION_STATES = [
  "disconnected",
  "connecting",
  "connected",
  "error",
  "recovering",
] as const;
export type ConnectionState = (typeof CONNECTION_STATES)[number];

export const CONNECTION_EVENTS = ["connect", "success", "fail", "retry", "disconnect"] as const;
export type ConnectionEvent = (typeof CONNECTION_EVENTS)[number];

export interface ConnectionTransitionResult {
  state: ConnectionState;
  error?: ConnectorError;
}

type TransitionTable = Record<ConnectionState, Partial<Record<ConnectionEvent, ConnectionState>>>;

/**
 * Legal transitions. `disconnect` is a hard reset available from every state (including a
 * no-op from `disconnected` itself). Recovery is the explicit `error --retry--> recovering
 * --success--> connected` path; `recovering --fail--> error` sends it back for another retry.
 */
const TRANSITIONS: TransitionTable = {
  disconnected: {
    connect: "connecting",
    disconnect: "disconnected",
  },
  connecting: {
    success: "connected",
    fail: "error",
    disconnect: "disconnected",
  },
  connected: {
    fail: "error",
    disconnect: "disconnected",
  },
  error: {
    retry: "recovering",
    disconnect: "disconnected",
  },
  recovering: {
    success: "connected",
    fail: "error",
    disconnect: "disconnected",
  },
};

/** Apply one event to a connection state. Pure; illegal events leave the state unchanged. */
export function transition(
  state: ConnectionState,
  event: ConnectionEvent,
): ConnectionTransitionResult {
  const next = TRANSITIONS[state][event];
  if (next === undefined) {
    return {
      state,
      error: invalidState(`Cannot handle event "${event}" while connection is "${state}".`),
    };
  }
  return { state: next };
}
