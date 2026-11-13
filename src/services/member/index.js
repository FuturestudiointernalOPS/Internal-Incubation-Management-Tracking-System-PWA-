/**
 * services/member — the MEMBER space's SERVICE layer.
 *
 * Use-case and decision code for the screens every member shares, as opposed to
 * the screens one context owns. It reads through `@/models/**` and the domain
 * services that already own each read, and never runs SQL itself (enforced by
 * `src/__tests__/server/services-boundaries.test.js`).
 *
 *   dashboard.js — the ONE personal dashboard: which blocks exist, from the
 *                  relationships the person actually holds
 */

export * from "./dashboard";
