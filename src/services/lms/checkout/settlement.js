/**
 * CHECKOUT — the settlement: the ONE place the money becomes access.
 *
 * Shared by the Kkiapay notification and the payer's own `verify` action so the
 * two can never diverge on the rule that matters: the amount is checked against
 * the price WE decided before anything is granted, and a divergent amount is
 * journaled as failed and NOT settled.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions here, statements in
 * `@/models/lms/registrations`; the receipt is handed to the mail transport.
 */

import {
  recordPaymentEvent,
  markRegistrationPaid,
  setEmailState,
  getRegistrationByReference,
  getRegistrationByTransactionId,
  providerAmountOf,
} from "@/models/lms/registrations";
import { deliverCheckoutEmail } from "@/lib/lms/checkoutMail";
import { fulfillRegistration } from "./fulfillment";

/** Resolve a claimed-but-unverified success back to its registration. */
export async function findRegistrationForReconcile({ reference, transactionId }) {
  return (
    (reference ? await getRegistrationByReference(reference) : null) ||
    (transactionId ? await getRegistrationByTransactionId(transactionId) : null)
  );
}

/**
 * Settle a payment the provider has CONFIRMED as successful — the ONE place the
 * money becomes access.
 *
 * The journal field values are passed in because the two callers record WHICH
 * value the provider reported (the notification journals its own `event`, the
 * verify journals the `verified` answer) — preserving that is what keeps the
 * audit trail byte-identical across the two paths.
 *
 * Returns { ok: true, fulfillment, delivery } once the registration is paid and
 * the receipt is out, or { ok: false, reason: "amount_mismatch" } — the caller
 * shapes the HTTP answer.
 */
export async function settleVerifiedPayment({
  registration,
  provider,
  verified,
  eventType,
  journalTransactionId,
  journalPartnerId = null,
  journalAmount = null,
  payload = null,
}) {
  // The provider reports in ITS unit; the price is stored in whole units, and
  // the amount actually asked for is remembered on the registration.
  const expected = providerAmountOf(registration);
  if (verified.amount != null && Number(verified.amount) !== Number(expected)) {
    // A divergent amount is a fraud/error signal: record it and refuse.
    await recordPaymentEvent({
      registrationId: registration.id,
      reference: registration.reference,
      runId: registration.run_id,
      provider: provider.name,
      eventType,
      transactionId: journalTransactionId,
      partnerId: journalPartnerId,
      amount: journalAmount,
      status: "failed",
      message: "amount_mismatch",
      ...(payload ? { payload } : {}),
    });
    return { ok: false, reason: "amount_mismatch" };
  }

  await markRegistrationPaid(registration.id, {
    provider: provider.name,
    transactionId: journalTransactionId,
    partnerId: journalPartnerId || verified.partnerId,
  });

  // The receipt goes out as soon as the MONEY is confirmed — even when the
  // access step is still in progress. Otherwise a payer whose access failed has
  // no receipt and a reason to pay twice.
  const fulfillment = await fulfillRegistration(registration.id);
  const delivery = await deliverCheckoutEmail({
    registration: { ...registration, status: "paid" },
    accessToken: fulfillment.ok ? fulfillment.accessToken : null,
  });
  await setEmailState(registration.id, { status: delivery.sent ? "sent" : "failed" });

  await recordPaymentEvent({
    registrationId: registration.id,
    reference: registration.reference,
    runId: registration.run_id,
    provider: provider.name,
    eventType,
    transactionId: journalTransactionId,
    partnerId: journalPartnerId,
    amount: journalAmount,
    status: "processed",
    message: fulfillment.ok ? "granted" : "access_failed",
    ...(payload ? { payload } : {}),
  });

  return { ok: true, fulfillment, delivery };
}