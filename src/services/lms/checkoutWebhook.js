/**
 * LMS service — the payment notification state machine (Kkiapay webhook).
 *
 * Layer (see docs/LAYER_SPLIT.md): the DECISIONS live here. The notification
 * carries NO status — only an event name — so it is never the decider:
 *
 *   - an unknown reference is journaled and NEVER creates a registration;
 *   - a duplicate on an already-paid registration does nothing;
 *   - an EXPLICIT failure is recorded as failed;
 *   - ANYTHING ELSE is handed to the SERVER-side verification, and the verified
 *     `status` decides — so an unanticipated payload shape repairs itself instead
 *     of silently swallowing a real payment.
 *
 * The amount check, the mark-paid, the access step and the receipt remain the
 * shared settlement in `./checkout` (`settleVerifiedPayment`), so the two paths
 * cannot diverge. Every statement lives in `@/models/lms/registrations`. No SQL,
 * no HTTP: the outcome is a value the HTTP boundary shapes into a response.
 */

import {
  getRegistrationByReference,
  getRegistrationByTransactionId,
  markRegistrationFailed,
  recordPaymentEvent,
} from "@/models/lms/registrations";
import { settleVerifiedPayment } from "./checkout";

/**
 * Decide what a payment notification means. `provider` is the payment adapter
 * (infrastructure) and `event` is what it parsed from the body; both are
 * supplied by the boundary. Returns one of:
 *
 *   { outcome: "unknown_reference" }
 *   { outcome: "duplicate" }
 *   { outcome: "explicit_failure" }
 *   { outcome: "verification_failed" }
 *   { outcome: "pending", verifiedStatus }
 *   { outcome: "amount_mismatch", reason }
 *   { outcome: "paid", fulfillment, delivery }
 */
export async function processPaymentNotification({ provider, event, body }) {
  const registration =
    (event.reference ? await getRegistrationByReference(event.reference) : null) ||
    (event.transactionId ? await getRegistrationByTransactionId(event.transactionId) : null);

  const journal = (eventType, status, message) =>
    recordPaymentEvent({
      registrationId: registration?.id || null,
      reference: event.reference || registration?.reference || null,
      runId: registration?.run_id || null,
      provider: provider.name,
      eventType,
      transactionId: event.transactionId,
      partnerId: event.partnerId,
      amount: event.amount,
      status,
      message,
      payload: body,
    });

  // ── An unknown reference is an investigation, never a registration ──
  if (!registration) {
    await journal("notification", "ignored", "unknown_reference");
    return { outcome: "unknown_reference" };
  }

  // ── A duplicate notification on an already-paid registration does nothing ──
  if (registration.status === "paid") {
    await journal("notification_duplicate", "ignored", "duplicate");
    return { outcome: "duplicate" };
  }

  // ── An EXPLICIT failure is the one case the notification short-circuits ──
  if (event.isExplicitFailure) {
    await markRegistrationFailed(registration.id, {
      transactionId: event.transactionId,
      partnerId: event.partnerId,
    });
    await journal("notification", "processed", "explicit_failure");
    return { outcome: "explicit_failure" };
  }

  // ── Everything else: the VERIFIED response decides ──
  const verified = await provider.verifyTransaction(event.transactionId);

  if (!verified.ok) {
    // Recoverable by our own sweep; a 5xx here would only produce retries that
    // stop after ~2.5s and leave no trace of why.
    await journal("notification", "failed", verified.error || "verification_pending");
    return { outcome: "verification_failed" };
  }

  if (!verified.isSuccess) {
    // The provider has not settled this transaction yet (a delayed success is
    // routine). Leave it pending and let the sweep close it.
    const verifiedStatus = verified.status || "unknown";
    await journal("notification", "processed", `verified_status:${verifiedStatus}`);
    return { outcome: "pending", verifiedStatus };
  }

  // The amount check, the mark-paid, the access step and the receipt are the
  // shared settlement (also used by the payer's own verify), so the two paths
  // cannot diverge.
  const settled = await settleVerifiedPayment({
    registration,
    provider,
    verified,
    eventType: "notification",
    journalTransactionId: event.transactionId,
    journalPartnerId: event.partnerId,
    journalAmount: event.amount,
    payload: body,
  });

  if (!settled.ok) {
    return { outcome: "amount_mismatch", reason: settled.reason };
  }

  return { outcome: "paid", fulfillment: settled.fulfillment, delivery: settled.delivery };
}
