/**
 * services/communications — the communications SERVICE layer.
 *
 * Use-case and decision code for the internal-comms, announcements, followups,
 * campaigns and events surfaces. It reads and writes through `@/models/**` (the
 * repository layer) and never runs SQL itself (enforced by
 * `src/__tests__/server/services-boundaries.test.js`).
 *
 *   messageScope.js — who may see which message
 *   campaigns.js — the campaign step/audience use-cases
 *   internalComms.js — the internal message scope engine + inbox/send/read
 */

export * from "./messageScope";
export * from "./campaigns";
export * from "./internalComms";
