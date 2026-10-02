/**
 * LMS — the team's registration decisions (SERVICE layer).
 *
 * The domain work behind `/api/lms/registrations/[id]`: the four team actions
 * and their rules — replay the access step, resend the one-time link, refund at
 * the provider, and take the course access back. The CONTROLLER keeps the
 * `lms.edit` capability, the body parsing and the response envelope.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/lib/lms/**` and `@/models/**`.
 */

import { getPaymentProvider } from "@/lib/integrations/payments";
import {
  getRegistrationById,
  markRegistrationAccessRevoked,
  markRegistrationRefunded,
  recordPaymentEvent,
  setEmailState,
} from "@/models/lms/registrations";
import {
  fulfillRegistration,
  prepareAccessDelivery,
  revokePurchaseAccess,
} from "@/services/lms/checkout";
import { deliverCheckoutEmail } from "@/lib/lms/checkoutMail";

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

/**
 * Apply one of the team actions to a registration:
 *
 *   retry-access   replay the course-access step (the payment is untouched);
 *   resend-email   issue a fresh one-time link and send it again;
 *   refund         refund at the provider, then record it. The LMS access is
 *                  deliberately NOT removed automatically — refunding and
 *                  revoking are two separate decisions, and the refund accepts
 *                  `revokeAccess: true` to do both in one step;
 *   revoke-access  take the course access back (only for a REFUNDED
 *                  registration).
 *
 * @returns {Promise<{status: number, body: Object}>}
 */
export async function applyRegistrationAction({ id, action, revokeAccess }) {
  const registration = await getRegistrationById(id);
  if (!registration) {
    return {
      status: 404,
      body: { success: false, error: "lms.errors.registrationNotFound" },
    };
  }

  if (action === "refund") {
    if (registration.status !== "paid") {
      return {
        status: 409,
        body: { success: false, error: "lms.errors.registrationNotPaid" },
      };
    }
    // The provider is the only thing that can actually refund.
    const provider = getPaymentProvider(
      registration.provider || process.env.PAYMENT_PROVIDER || "kkiapay",
    );
    const refund =
      provider && provider.refundTransaction
        ? await provider.refundTransaction(registration.provider_transaction_id)
        : { ok: false, error: "lms.errors.refundFailed" };

    if (!refund.ok) {
      return { status: 502, body: { success: false, error: refund.error } };
    }
    await markRegistrationRefunded(registration.id);

    // The access is a SEPARATE decision; the caller may do both in one step.
    const revoked = revokeAccess === true ? await revokeAccessOf(registration) : false;
    return {
      status: 200,
      body: { success: true, status: "refunded", access_revoked: revoked },
    };
  }

  if (action === "revoke-access") {
    if (registration.status !== "refunded") {
      return {
        status: 409,
        body: { success: false, error: "lms.errors.revokeOnlyWhenRefunded" },
      };
    }
    const revoked = await revokeAccessOf(registration);
    if (!revoked) {
      return {
        status: 409,
        body: { success: false, error: "lms.errors.noAccessToRevoke" },
      };
    }
    return {
      status: 200,
      body: { success: true, status: "refunded", access: "revoked" },
    };
  }

  if (action === "retry-access" || action === "resend-email") {
    if (registration.status !== "paid") {
      return {
        status: 409,
        body: { success: false, error: "lms.errors.registrationNotPaid" },
      };
    }

    // Replay the access step when it is not established, then hand over a
    // FRESH one-time link (never a stored one — only hashes are kept).
    let accessToken = null;
    if (registration.access_status !== "granted") {
      const fulfillment = await fulfillRegistration(registration.id);
      if (!fulfillment.ok) {
        return { status: 500, body: { success: false, error: fulfillment.error } };
      }
      accessToken = fulfillment.accessToken;
    } else {
      ({ accessToken } = await prepareAccessDelivery(registration));
    }

    const delivery = await deliverCheckoutEmail({ registration, accessToken });
    await setEmailState(registration.id, { status: delivery.sent ? "sent" : "failed" });

    return {
      status: 200,
      body: {
        success: true,
        access: "granted",
        email_sent: delivery.sent,
        email_error: delivery.error || null,
      },
    };
  }

  return {
    status: 400,
    body: { success: false, error: "lms.errors.invalidAction" },
  };
}
