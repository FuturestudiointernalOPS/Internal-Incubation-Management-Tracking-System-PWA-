/**
 * CHECKOUT EXECUTION — everything that happens around the money for a paid
 * Execution: resolve the price SERVER-side, capture the registration, grant the
 * course access, and hand back a link only inside a short window.
 *
 * Reuses the existing identity (`contacts.cid`), the existing enrollment table
 * (`lms_enrollments`, source 'purchase') and the existing one-time password flow
 * (`password_setup_tokens`). No parallel users table, no parallel enrollment.
 *
 * Layer (see docs/LAYER_SPLIT.md): the decisions live in `./checkout/` — the
 * run ↔ course link (`runCourse`), the purchase identity + revoke (`identity`),
 * the one-time token and the payer's window (`accessToken`), access fulfilment
 * (`fulfillment`), the capture (`capture`), the way back for an existing
 * registration (`resume`) and the settlement (`settlement`). This file
 * re-exports the same public surface, so importers and tests are unchanged.
 *
 * Every statement lives in `@/models/lms/checkoutStore` (and the registration
 * helpers in `@/models/lms/registrations`).
 */

export { resolveCheckoutCourse, getPaidRunContext, linkRunToCourse } from "./checkout/runCourse";
export {
  findContactForPurchase,
  insertPurchaseContact,
  insertPurchaseEnrollment,
  revokePurchaseAccess,
} from "./checkout/identity";
export { issueAccessToken, accessWindowMinutes, accessWindowOpen } from "./checkout/accessToken";
export {
  fulfillRegistration,
  mintAccessLinkForPayer,
  getCheckoutStateForPayer,
  prepareAccessDelivery,
} from "./checkout/fulfillment";
export { startCheckoutForSubmission } from "./checkout/capture";
export { resolveResumeToken, issueResumeLink, findResumableRegistration } from "./checkout/resume";
export { findRegistrationForReconcile, settleVerifiedPayment } from "./checkout/settlement";

export { recordPaymentEvent, markRegistrationPaid, setEmailState, setAccessState } from "@/models/lms/registrations";