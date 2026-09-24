import { defaultPaymentProvider } from "@/lib/integrations/payments";
import {
  getRegistrationById,
  listPaidRegistrationsNeedingAccess,
  listPaymentEvents,
  markRegistrationPaid,
  recordPaymentEvent,
  setEmailState,
  toProviderAmount,
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
 *      refused) that is still unpaid                     now settles, finish it.
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
    if (!registration || registration.status === "paid") continue;

    summary.checked += 1;

    const verified = await provider.verifyTransaction(event.provider_transaction_id);
    if (!verified.ok || !verified.isSuccess) continue;
    // The provider reports in ITS unit; the price is stored in whole units.
    const expected = toProviderAmount(registration.amount);
    if (verified.amount != null && Number(verified.amount) !== Number(expected)) continue;

    await markRegistrationPaid(registration.id, {
      provider: provider.name,
      transactionId: event.provider_transaction_id,
      partnerId: verified.partnerId,
    });
    summary.recovered += 1;

    await completeAccess({ ...registration, status: "paid" }, summary, "recovered");
  }

  return summary;
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
