/**
 * REQUEST CONTEXT — one id that follows a request through every layer.
 *
 * A slow or failing request is diagnosed by joining the lines that describe it:
 * the API entry, the authorization decision, the database call. Those lines are
 * written in different modules that know nothing about HTTP, so the id they carry
 * cannot be passed down as an argument everywhere — it is carried by
 * `AsyncLocalStorage` instead, which follows the async call chain without any
 * change to the functions in between.
 *
 *   createHandler
 *     └─ runWithRequestContext({ requestId, route, method }, handler)
 *          ├─ requireAuthorization → logger.warn("authorization_denied", { requestId })
 *          └─ db.execute          → logger.warn("db_slow_query", { requestId })
 *
 * Outside a request (a cron script, a test) the store is empty and `getRequestId`
 * returns null: logging degrades to "no correlation", it never throws.
 */

import { AsyncLocalStorage } from "node:async_hooks";

const storage = new AsyncLocalStorage();

/** A collision-resistant id, with a safe fallback for runtimes without randomUUID. */
export function newRequestId() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
    // fall through
  }
  // Best effort only — uniqueness, not unpredictability, is required here.
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Run `fn` with `context` (at least `{ requestId }`) visible to everything it awaits. */
export function runWithRequestContext(context, fn) {
  return storage.run({ ...context }, fn);
}

/** The whole active context, or null outside a request. */
export function getRequestContext() {
  return storage.getStore() || null;
}

/** The active correlation id, or null outside a request. */
export function getRequestId() {
  return storage.getStore()?.requestId ?? null;
}

/**
 * Wrap a raw route handler so every line it (and everything it awaits) writes
 * carries a request id, and the id is echoed on the response.
 *
 * `createHandler` builds this in for the wrapped routes; this is for the few
 * hand-written handlers (the sign-in routes) that do not use it.
 */
export function withRequestContext(handler, route) {
  return function (req, ...args) {
    let label = route;
    if (!label) {
      try {
        label = req?.url ? new URL(req.url).pathname : "unknown";
      } catch {
        label = "unknown";
      }
    }
    const requestId =
      (req?.headers?.get?.("x-request-id") || "").trim() || newRequestId();
    const method = req?.method || "GET";

    return runWithRequestContext({ requestId, route: label, method }, async () => {
      const response = await handler(req, ...args);
      try {
        if (response && typeof response.headers?.set === "function") {
          response.headers.set("x-request-id", requestId);
        }
      } catch {
        // A plain object has no headers — nothing to tag.
      }
      return response;
    });
  };
}

/**
 * Enrich the active context (e.g. add the authenticated user once known).
 * Returns false when called outside a request.
 */
export function setRequestContext(patch) {
  const store = storage.getStore();
  if (!store || !patch) return false;
  Object.assign(store, patch);
  return true;
}

export default {
  newRequestId,
  runWithRequestContext,
  getRequestContext,
  getRequestId,
  setRequestContext,
  withRequestContext,
};
