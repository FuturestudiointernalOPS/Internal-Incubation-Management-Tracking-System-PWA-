/**
 * server/auth — the authentication layer.
 *
 * Answers "who is calling?". Authorization ("what may they do?") is a separate
 * layer and must not be imported from here.
 *
 *   session.js  — the server-side session record (create / read / destroy)
 *   cookies.js  — the cookie that carries the token, and its durations
 *   password.js — the single seam to the hashing algorithm
 *   guards.js   — requireSession / requireAuth
 *
 * New code imports from `@/server/auth`. `@/lib/auth` keeps re-exporting these
 * for the importers that predate the split.
 */

export * from "./cookies";
export * from "./password";
export * from "./session";
export * from "./guards";
