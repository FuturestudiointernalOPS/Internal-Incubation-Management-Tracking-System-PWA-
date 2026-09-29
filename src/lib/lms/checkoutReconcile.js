import { defaultPaymentProvider } from "@/lib/integrations/payments";
import {
  getRegistrationById,
  listPaidRegistrationsNeedingAccess,
  listPaymentEvents,
  listPendingRegistrationsWithTransactionId,
  markRegistrationPaid,
  providerAmountOf,
  recordPaymentEvent,
  setEmailState,
} from "@/lib/lms/registrations";
import { fulfillRegistration } from "@/lib/lms/checkout";
import { deliverCheckoutEmail } from "@/lib/lms/checkoutMail";

/**
 * CHECKOUT RECONCILIATION — the safety net Kkiapay's retries cannot be.
 *
 * Kkiapay re-delivers a notification about five times within ~2.5 seconds. That
 * is far too short to wait out a verification outage, so anything we could not
 * confirm is JOURNALED and closed here instead:
 *
 *   1. a confirmed payment whose ACCESS step failed   -> replay the step;
 *   2. a success we could not verify (or an amount we  -> re-verify, and if it
 *      refused) that is still unpaid                     now settles, finish it;
 *   3. a transaction somebody reported (the browser    -> re-verify, even after
 *      or a notification) that nothing ever settled        the payer's tab is gone.
 *
 * A registration that is already paid is never touched, so a sweep can run as
 * often as we like. Returns a summary the caller can log or show.
 */
export async function reconcileRegistrations({ limit = 25 } = {}) {
  const summary = { checked: 0, accessGranted: 0, recovered: 0, failed: 0 };

  // ── 1. Paid, but the course access never landed ──
  const needingAccess = await listPaidRegistrationsNeedingAccess();
  for (const registration of needingAccess.slice(0, limit)) {
    summary.checked += 1;
    await completeAccess(registration, summary, "access_retried");
  }

  // ── 2. A success that was never verified (or a refused amount) ──
  const provider = defaultPaymentProvider();
  const failedEvents = await listPaymentEvents({ status: "failed" });
  const seen = new Set();

  for (const event of failedEvents.slice(0, limit)) {
    if (!event.registration_id || !event.provider_transaction_id) continue;
    const key = `${event.registration_id}:${event.provider_transaction_id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const registration = await getRegistrationById(event.registration_id);
    await recoverPayment(provider, registration, event.provider_transaction_id, summary);
  }

  // ── 3. A transaction somebody reported, but nothing ever settled ──
  // The payer's tab may be long closed; the id it recorded is still evidence, so
  // the provider is asked again. This is what makes a MISSED notification
  // recoverable for a person who is no longer sitting on the page.
  const pendingWithId = await listPendingRegistrationsWithTransactionId(limit);
  for (const registration of pendingWithId) {
    await recoverPayment(provider, registration, registration.provider_transaction_id, summary);
  }

  return summary;
}

/** Re-verify ONE transaction and, if the money really moved, settle it. */
async function recoverPayment(provider, registration, transactionId, summary) {
  if (!registration || !transactionId || registration.status === "paid") return;
  summary.checked += 1;

  const verified = await provider.verifyTransaction(transactionId);
  if (!verified.ok || !verified.isSuccess) return;
  // The provider reports in ITS unit; the price is stored in whole units, and
  // the amount actually asked for is remembered on the registration.
  const expected = providerAmountOf(registration);
  if (verified.amount != null && Number(verified.amount) !== Number(expected)) return;

  await markRegistrationPaid(registration.id, {
    provider: provider.name,
    transactionId,
    partnerId: verified.partnerId,
  });
  summary.recovered += 1;

  await completeAccess({ ...registration, status: "paid" }, summary, "recovered");
}

/** Finish the access + receipt for one paid registration, recording the outcome. */
async function completeAccess(registration, summary, message) {
  const fulfillment = await fulfillRegistration(registration.id);
  if (!fulfillment.ok) {
    summary.failed += 1;
    return;
  }

  summary.accessGranted += 1;
  const delivery = await deliverCheckoutEmail({
    registration,
    accessToken: fulfillment.accessToken,
  });
  await setEmailState(registration.id, { status: delivery.sent ? "sent" : "failed" });
  await recordPaymentEvent({
    registrationId: registration.id,
    reference: registration.reference,
    runId: registration.run_id,
    provider: registration.provider,
    eventType: "reconcile",
    transactionId: registration.provider_transaction_id,
    amount: registration.amount,
    status: "processed",
    message,
  });
}
