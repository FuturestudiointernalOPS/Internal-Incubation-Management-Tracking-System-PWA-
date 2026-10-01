/**
 * services/projects — the projects SERVICE layer.
 *
 * Use-case and decision code for the projects domain. It reads and writes
 * through `@/models/**` (the repository layer) and never runs SQL itself
 * (enforced by `src/__tests__/server/services-boundaries.test.js`).
 *
 *   workspace.js — the project list/create/update/delete use cases, the
 *                  portfolio access rule, lead resolution and meta merge
 *   collaboration.js — members, assignments dropdown, discussions, invitations
 *                  and the invitation response flow
 */

export * from "./workspace";
export * from "./collaboration";
