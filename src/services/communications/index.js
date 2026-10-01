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
 *   announcements.js — the announcement feed/publish/moderate use-cases
 *   followups.js — the follow-up create/update use-cases
 *   events.js — the calendar-event create use-case
 */

export * from "./messageScope";
export * from "./campaigns";
export * from "./internalComms";
export * from "./announcements";
export * from "./followups";
export * from "./events";
export * from "./notifications";
export * from "./ventureNotifications";
export * from "./inboxNotifications";
