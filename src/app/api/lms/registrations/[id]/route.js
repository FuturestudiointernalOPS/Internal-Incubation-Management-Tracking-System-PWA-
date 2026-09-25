import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { lmsErrorResponse } from "@/lib/lms/errors";
import { getPaymentProvider } from "@/lib/integrations/payments";
import {
  getRegistrationById,
  markRegistrationAccessRevoked,
  markRegistrationRefunded,
  recordPaymentEvent,
  setEmailState,
} from "@/lib/lms/registrations";
import { fulfillRegistration, prepareAccessDelivery, revokePurchaseAccess } from "@/lib/lms/checkout";
import { deliverCheckoutEmail } from "@/lib/lms/checkoutMail";

export const dynamic = "force-dynamic";

/**
 * POST /api/lms/registrations/[id]  { action }
 *
 * The team actions, all server-side:
 *   retry-access   replay the course-access step (the payment is untouched);
 *   resend-email   issue a fresh one-time link and send it again;
 *   refund         refund at the provider, then record it. The LMS access is
 *                  deliberately NOT removed automatically — see the next line;
 *   revoke-access  take the course access back (only for a REFUNDED
 *                  registration). Refunding and revoking are two separate
 *                  decisions the team makes knowingly, and the refund accepts
 *                  `revokeAccess: true` to do both in one step.
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

      // The access is a SEPARATE decision; the caller may do both in one step.
      const revoked = body.revokeAccess === true ? await revokeAccessOf(registration) : false;
      return NextResponse.json({ success: true, status: "refunded", access_revoked: revoked });
    }

    if (action === "revoke-access") {
      if (registration.status !== "refunded") {
        return NextResponse.json({ success: false, error: "lms.errors.revokeOnlyWhenRefunded" }, { status: 409 });
      }
      const revoked = await revokeAccessOf(registration);
      if (!revoked) {
        return NextResponse.json({ success: false, error: "lms.errors.noAccessToRevoke" }, { status: 409 });
      }
      return NextResponse.json({ success: true, status: "refunded", access: "revoked" });
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

/**
 * Suspend the purchase enrollment and record the state on the registration,
 * with a journal line so the revocation is visible in the team view. Returns
 * whether an access actually existed to take back.
 */
async function revokeAccessOf(registration) {
  const { revoked } = await revokePurchaseAccess({
    courseId: registration.course_id,
    userCid: registration.user_cid,
  });
  if (!revoked) return false;

  await markRegistrationAccessRevoked(registration.id);
  await recordPaymentEvent({
    registrationId: registration.id,
    reference: registration.reference,
    runId: registration.run_id,
    provider: registration.provider || null,
    eventType: "access.revoked",
    status: "processed",
    message: "access_revoked",
  }).catch(() => {});
  return true;
}
