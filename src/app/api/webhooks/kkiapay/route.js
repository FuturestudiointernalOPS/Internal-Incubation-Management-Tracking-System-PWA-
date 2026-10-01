import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { getPaymentProvider } from "@/lib/integrations/payments";
import {
  getRegistrationByReference,
  getRegistrationByTransactionId,
  markRegistrationFailed,
  recordPaymentEvent,
} from "@/lib/lms/registrations";
import { settleVerifiedPayment } from "@/services/lms/checkout";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/kkiapay — the TRUTH about a payment.
 *
 * The notification carries NO status: only `event` ("transaction.success" /
 * "transaction.failed") and `isPaymentSucces`, plus `transactionId`, `partnerId`
 * and `amount`. So it is NEVER the decider here:
 *
 *   - a missing/invalid signature is refused outright;
 *   - an unknown reference is journaled and NEVER creates a registration;
 *   - a duplicate on an already-paid registration does nothing;
 *   - an EXPLICIT failure is recorded as failed;
 *   - ANYTHING ELSE is handed to the SERVER-side verification, and the verified
 *     `status` decides — so an unanticipated payload shape repairs itself
 *     instead of silently swallowing a real payment.
 *
 * A success we could not verify is journaled and picked up by the reconciliation
 * sweep: Kkiapay only retries about five times within ~2.5s, which is far too
 * short to wait out a verification outage.
 */
export async function POST(req) {
  try {
    await initDb();

    const provider = getPaymentProvider(process.env.PAYMENT_PROVIDER || "kkiapay");
    if (!provider) {
      return NextResponse.json({ success: false, error: "lms.errors.paymentProviderUnknown" }, { status: 400 });
    }

    const raw = await req.text();

    if (!provider.canVerifyWebhook()) {
      return NextResponse.json(
        { success: false, error: "lms.errors.paymentProviderNotConfigured" },
        { status: 503 },
      );
    }
    if (!provider.verifyWebhookSignature(req)) {
      return NextResponse.json(
        { success: false, error: "lms.errors.paymentSignatureInvalid" },
        { status: 401 },
      );
    }

    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ success: false, error: "lms.errors.invalidPayload" }, { status: 400 });
    }

    const event = provider.parseWebhook(body);
    if (!event.transactionId && !event.reference) {
      return NextResponse.json({ success: false, error: "lms.errors.invalidPayload" }, { status: 400 });
    }

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
      return NextResponse.json({ success: true, ignored: true });
    }

    // ── A duplicate notification on an already-paid registration does nothing ──
    if (registration.status === "paid") {
      await journal("notification_duplicate", "ignored", "duplicate");
      return NextResponse.json({ success: true, duplicate: true });
    }

    // ── An EXPLICIT failure is the one case the notification short-circuits ──
    if (event.isExplicitFailure) {
      await markRegistrationFailed(registration.id, {
        transactionId: event.transactionId,
        partnerId: event.partnerId,
      });
      await journal("notification", "processed", "explicit_failure");
      return NextResponse.json({ success: true, recorded: true, payment: "failed" });
    }

    // ── Everything else: the VERIFIED response decides ──
    const verified = await provider.verifyTransaction(event.transactionId);

    if (!verified.ok) {
      // Recoverable by our own sweep; a 5xx here would only produce retries that
      // stop after ~2.5s and leave no trace of why.
      await journal("notification", "failed", verified.error || "verification_pending");
      return NextResponse.json({ success: true, recorded: true, verified: false });
    }

    if (!verified.isSuccess) {
      // The provider has not settled this transaction yet (a delayed success is
      // routine). Leave it pending and let the sweep close it.
      await journal("notification", "processed", `verified_status:${verified.status || "unknown"}`);
      return NextResponse.json({ success: true, recorded: true, verified: true, payment: "pending" });
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
      return NextResponse.json({ success: true, ignored: true, reason: settled.reason });
    }

    return NextResponse.json({
      success: true,
      payment: "paid",
      access: settled.fulfillment.ok ? "granted" : "failed",
      email: settled.delivery.sent ? "sent" : "failed",
    });
  } catch (error) {
    console.error("[kkiapay webhook]", error);
    return NextResponse.json({ success: false, error: "errors.somethingWrong" }, { status: 500 });
  }
}
