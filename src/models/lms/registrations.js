/**
 * CHECKOUT REGISTRATIONS (public form run -> payment -> course access)
 *
 * Everything the checkout knows about a person BEFORE money moves, plus the
 * payment outcome attached to the SAME row. Captured first, money second, access
 * third — so an abandoned or failed payment is a follow-up opportunity instead
 * of a lost lead.
 *
 * Three INDEPENDENT states, deliberately never collapsed into one:
 *   - `status`        the money   (pending / paid / failed / cancelled / refunded)
 *   - `access_status` the course  (pending / granted / failed)
 *   - `email_status`  the receipt (pending / sent / failed)
 *
 * Invariants owned here:
 *   - one reference = one registration (generated here, never client-supplied);
 *   - one person + one course = one registration, so a retry UPDATES the row;
 *   - the amount is a SERVER-decided snapshot, never the browser's claim;
 *   - a paid registration is never silently rewritten.
 *
 * This file is a thin BARREL over cohesive modules in the sibling
 * `models/lms/registrations/` folder (the `x.js` + `x/` convention):
 *
 *   helpers.js  — the pure value helpers and the shared row projection
 *   schema.js   — the self-healing checkout schema (once per process)
 *   store.js    — the core reads, the create and the state writes
 *   payments.js — the payment-event journal
 *   lists.js    — the team-view lists, counters and reconciliation sweeps
 *
 * The helpers barrel is EXPLICIT: `parseRegistration` and `REGISTRATION_SELECT`
 * stay internal, so the public surface is exactly what it was before the split.
 *
 * See supabase/migrations/20260924_lms_checkout_registrations.sql.
 */

export * from "./registrations/schema";
export * from "./registrations/store";
export * from "./registrations/payments";
export * from "./registrations/lists";

export {
  paymentCurrency,
  paymentAmountMultiplier,
  toProviderAmount,
  fromProviderAmount,
  normalizeRegistrationEmail,
  generateReference,
  providerAmountOf,
} from "./registrations/helpers";
