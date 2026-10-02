import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { getPaymentProvider } from "@/lib/integrations/payments";
import { processPaymentNotification } from "@/services/lms";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/kkiapay — the TRUTH about a payment.
 *
 * The notification carries NO status: only `event` ("transaction.success" /
 * "transaction.failed") and `isPaymentSucces`, plus `transactionId`, `partnerId`
 * and `amount`. So it is NEVER the decider — the state machine that decides what
 * it means (unknown reference, duplicate, explicit failure, verify-then-settle)
 * lives in `@/services/lms`.
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

    const result = await processPaymentNotification({ provider, event, body });

    switch (result.outcome) {
      case "unknown_reference":
        return NextResponse.json({ success: true, ignored: true });
      case "duplicate":
        return NextResponse.json({ success: true, duplicate: true });
      case "explicit_failure":
        return NextResponse.json({ success: true, recorded: true, payment: "failed" });
      case "verification_failed":
        return NextResponse.json({ success: true, recorded: true, verified: false });
      case "pending":
        return NextResponse.json({ success: true, recorded: true, verified: true, payment: "pending" });
      case "amount_mismatch":
        return NextResponse.json({ success: true, ignored: true, reason: result.reason });
      case "paid":
        return NextResponse.json({
          success: true,
          payment: "paid",
          access: result.fulfillment.ok ? "granted" : "failed",
          email: result.delivery.sent ? "sent" : "failed",
        });
      default:
        return NextResponse.json({ success: false, error: "errors.somethingWrong" }, { status: 500 });
    }
  } catch (error) {
    console.error("[kkiapay webhook]", error);
    return NextResponse.json({ success: false, error: "errors.somethingWrong" }, { status: 500 });
  }
}
