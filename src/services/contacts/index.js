/**
 * services/contacts — the contacts / CRM SERVICE layer.
 *
 * Use-case and decision code for the contacts domain. It reads and writes
 * through `@/models/**` (the repository layer) and never runs SQL itself
 * (enforced by `src/__tests__/server/services-boundaries.test.js`).
 *
 *   contactGroupSync.js — link a person to their CRM group and program, and the
 *                         idempotent reconciliation that repairs older records
 *   contactLookup.js — the identity question "which person is this email?"
 *   participantSync.js — keep a contact's v2_participants row Active
 */

export * from "./contactGroupSync";
export * from "./contactLookup";
export * from "./participantSync";
