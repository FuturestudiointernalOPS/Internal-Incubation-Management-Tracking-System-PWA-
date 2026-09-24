import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { lmsErrorResponse } from "@/lib/lms/errors";
import { getPaymentProvider } from "@/lib/integrations/payments";
import {
  getRegistrationById,
  markRegistrationRefunded,
  setEmailState,
} from "@/lib/lms/registrations";
import { fulfillRegistration, prepareAccessDelivery } from "@/lib/lms/checkout";
import { deliverCheckoutEmail } from "@/lib/lms/checkoutMail";

export const dynamic = "force-dynamic";

/**
 * POST /api/lms/registrations/[id]  { action }
 *
 * The three team actions, all server-side:
 *   retry-access  replay the course-access step (the payment is untouched);
 *   resend-email  issue a fresh one-time link and send it again;
 *   refund        refund at the provider, then record it. The LMS access is
 *                 deliberately NOT removed automatically: revoking access is a
 *                 separate decision the team makes knowingly.
 *
 * Requires lms.edit.
 */
export async function POST(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "edit");
    if (capError) return capError;

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    const registration = await getRegistrationById(id);
    if (!registration) {
      return NextResponse.json({ success: false, error: "lms.errors.registrationNotFound" }, { status: 404 });
    }

    if (action === "refund") {
      if (registration.status !== "paid") {
        return NextResponse.json({ success: false, error: "lms.errors.registrationNotPaid" }, { status: 409 });
      }
      // The provider is the only thing that can actually refund.
      const provider = getPaymentProvider(registration.provider || process.env.PAYMENT_PROVIDER || "kkiapay");
      const refund = provider?.refundTransaction
        ? await provider.refundTransaction(registration.provider_transaction_id)
        : { ok: false, error: "lms.errors.refundFailed" };

      if (!refund.ok) {
        return NextResponse.json({ success: false, error: refund.error }, { status: 502 });
      }
      await markRegistrationRefunded(registration.id);
      return NextResponse.json({ success: true, status: "refunded" });
    }

    if (action === "retry-access" || action === "resend-email") {
      if (registration.status !== "paid") {
        return NextResponse.json({ success: false, error: "lms.errors.registrationNotPaid" }, { status: 409 });
      }

      // Replay the access step when it is not established, then hand over a
      // FRESH one-time link (never a stored one — only hashes are kept).
      let accessToken = null;
      if (registration.access_status !== "granted") {
        const fulfillment = await fulfillRegistration(registration.id);
        if (!fulfillment.ok) {
          return NextResponse.json({ success: false, error: fulfillment.error }, { status: 500 });
        }
        accessToken = fulfillment.accessToken;
      } else {
        ({ accessToken } = await prepareAccessDelivery(registration));
      }

      const delivery = await deliverCheckoutEmail({ registration, accessToken });
      await setEmailState(registration.id, { status: delivery.sent ? "sent" : "failed" });

      return NextResponse.json({
        success: true,
        access: "granted",
        email_sent: delivery.sent,
        email_error: delivery.error || null,
      });
    }

    return NextResponse.json({ success: false, error: "lms.errors.invalidAction" }, { status: 400 });
  } catch (error) {
    return lmsErrorResponse(error);
  }
}
