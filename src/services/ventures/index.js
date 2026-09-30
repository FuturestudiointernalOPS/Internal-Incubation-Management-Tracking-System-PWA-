/**
 * services/ventures — the ventures SERVICE layer.
 *
 * Use-case and decision code for the ventures domain. It reads and writes
 * through `@/models/**` (the repository layer) and never runs SQL itself
 * (enforced by `src/__tests__/server/services-boundaries.test.js`).
 *
 *   ventureDocumentTypes.js — a Venture's Data-bank document list
 */

export * from "./ventureDocumentTypes";
