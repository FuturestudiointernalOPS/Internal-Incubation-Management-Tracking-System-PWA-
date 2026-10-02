/**
 * services/lms — the LMS SERVICE layer.
 *
 * Use-case and decision code for the LMS domain. It reads and writes through
 * `@/models/lms/**` (the repository layer) and never runs SQL itself (enforced by
 * `src/__tests__/server/services-boundaries.test.js`).
 *
 *   learning.js — the learner experience: progress, completion, access,
 *                 assessment submission and certificate finalisation
 *   checkout.js — the paid-course checkout: price resolution, registration
 *                 capture, access grant, the shared verified-payment settlement
 *                 and the one-time access/resume links
 *   checkoutReconcile.js — the checkout reconciliation sweep: replay a failed
 *                 access step and re-verify a success we could not confirm
 *   coaching.js — the learner coaching-request queue (create, staff decision,
 *                 cancel) and its notification fan-out
 *   registrations.js — the team's registration decisions (retry, resend,
 *                 refund, revoke access)
 *   checkoutWebhook.js — the payment notification state machine (the Kkiapay
 *                 webhook): unknown reference, duplicate, explicit failure,
 *                 verify-then-settle
 *   publicRegistration.js — the public registration surfaces: the group lookup
 *                 and fallback, the anonymous-submission rule, the
 *                 facilitator/participant conflict guard, and the public group
 *                 info (group + registration window)
 */

export * from "./learning";
export * from "./checkout";
export * from "./checkoutReconcile";
export * from "./coaching";
export * from "./registrations";
export * from "./checkoutWebhook";
export * from "./publicRegistration";
