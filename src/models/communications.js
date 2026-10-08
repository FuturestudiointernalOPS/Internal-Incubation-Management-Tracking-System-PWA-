/**
 * Communications model — data access for the internal-comms, announcements,
 * followups, campaigns and events controllers
 * (`src/app/api/internal-comms/route.js`, `src/app/api/announcements/route.js`,
 *  `src/app/api/followups/route.js`, `src/app/api/campaigns/route.js`,
 *  `src/app/api/campaigns/[id]/route.js`, `src/app/api/events/route.js`).
 *
 * This file is a thin BARREL over cohesive modules in the sibling
 * `models/communications/` folder (the split convention: `x.js` + `x/`):
 *
 *   scope.js         — message-scope resolution (groups, programs, members)
 *   messages.js      — internal-message reads/writes and the mark-read path
 *   announcements.js — the announcement feed, publish and archive queries
 *   followups.js     — follow-up reads/writes and the team-scope guards
 *   campaigns.js     — the (retired) campaign queries
 *   events.js        — the calendar-event queries
 *
 * The SQL is byte-identical to what used to sit inline here, so behaviour is
 * unchanged. Importers keep the same path (`@/models/communications`).
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

export * from "./communications/scope";
export * from "./communications/messages";
export * from "./communications/announcements";
export * from "./communications/followups";
export * from "./communications/campaigns";
export * from "./communications/events";

/**
 * GET /api/internal-comms — the inbox rows for the requester's visibility scope.
 *
 * The policy moved to `@/services/communications/messageScope` (the decision),
 * with its statement in `@/models/messageScopeStore`. Re-exported here so
 * existing importers (the internal-comms route) keep working — see
 * docs/LAYER_SPLIT.md.
 */
export { listMessagesForScope } from "@/services/communications/messageScope";
