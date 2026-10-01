/**
 * services/email — the email SERVICE layer.
 *
 * Use-case and decision code for email. It reads and writes through
 * `@/models/emailLogStore` (the repository layer) and never runs SQL itself
 * (enforced by `src/__tests__/server/services-boundaries.test.js`).
 *
 *   log.js — the delivery log: schema self-heals, history reads, the
 *            idempotency probe, the status/bounce/Resend records and the stats
 *
 * The transports, the template engine and the copy/resolvers stay in
 * `src/lib/email.js` (pure infrastructure) and re-export this service.
 */

export * from "./log";
