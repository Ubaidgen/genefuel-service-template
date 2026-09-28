import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";

export const REQUEST_ID_HEADER = "x-request-id";

/** Accept a caller's request id only if it is short and boring — it ends up in logs. */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

export function resolveRequestId(req: IncomingMessage): string {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
  return candidate && SAFE_REQUEST_ID.test(candidate) ? candidate : randomUUID();
}

export function requestIdOf(req: { id?: unknown }): string {
  return typeof req.id === "string" ? req.id : "unknown";
}
