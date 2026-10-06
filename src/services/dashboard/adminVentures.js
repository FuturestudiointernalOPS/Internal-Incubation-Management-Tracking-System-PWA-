/**
 * Admin ventures — the super-admin "Add a Venture" fast-path (SERVICE layer).
 *
 * The work behind `POST /api/admin/ventures/create`: the input validation, the
 * duplicate handling, the founder INVITATION (never a fabricated account or a
 * written membership — the invitation screen does that), the recorded delivery
 * outcome, and the activity entry.
 *
 * HTTP-free: it writes through `@/models/ventureAdmin` and
 * `@/models/ventureMemberInvitations`, mails through `@/lib/email` and reads the
 * app URL through `@/lib/appUrl`. The controller keeps the super-admin gate and
 * the envelope.
 */

import { logVentureActivity } from "@/services/ventures/activity";
import { resolveAppUrl } from "@/lib/appUrl";
import { createAdminVenture } from "@/models/ventureAdmin";
import {
  createVentureMemberInvitation,
  recordVentureMemberInvitationDelivery,
} from "@/models/ventureMemberInvitations";
import { sendVentureFounderInvitationEmail } from "@/lib/email";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Record a Venture and invite its founder in one step. The Venture is created
 * ACTIVE (an administrator vouches for it); the founder receives an invitation
 * link where they either create their account or accept as an existing user.
 *
 * @returns {Promise<{status:number, body:object}>}
 */
export async function createVentureWithFounderInvite({
  companyName,
  founderEmail,
  actor,
}) {
  const name = typeof companyName === "string" ? companyName.trim() : "";
  const email = typeof founderEmail === "string" ? founderEmail.trim() : "";

  if (name.length < 2) {
    return {
      status: 400,
      body: { success: false, error: "vadmin.list.addVentureNameRequired" },
    };
  }
  if (!email) {
    return {
      status: 400,
      body: { success: false, error: "vadmin.list.addVentureEmailRequired" },
    };
  }
  if (!EMAIL_RE.test(email)) {
    return {
      status: 400,
      body: { success: false, error: "vadmin.list.addVentureEmailInvalid" },
    };
  }

  const created = await createAdminVenture({
    companyName: name,
    createdByCid: actor?.cid || null,
  });
  if (created.conflict) {
    return {
      status: 409,
      body: { success: false, error: "vadmin.list.addVentureDuplicate" },
    };
  }

  // The founder is invited, not written in: the invitation screen is where the
  // account is created and the membership is granted.
  const invitation = await createVentureMemberInvitation({
    ventureId: created.venture_id,
    email,
    memberType: "founder",
    invitedByCid: actor?.cid || null,
  });

  // Never block the answer on the mailer: a failed send is recorded on the
  // invitation and reported back so the admin knows no email actually left.
  let emailSent = false;
  let emailError = null;
  try {
    const link = `${resolveAppUrl()}/venture-invite/${invitation.token}`;
    const mailResult = await sendVentureFounderInvitationEmail({
      to: invitation.email,
      ventureName: created.company_name,
      inviteUrl: link,
      expiresAt: invitation.expires_at,
    });
    if (mailResult?.success) {
      emailSent = true;
    } else {
      emailError =
        mailResult?.error ||
        mailResult?.note ||
        "The email provider is not configured.";
    }
  } catch (error) {
    emailError = error.message;
  }
  await recordVentureMemberInvitationDelivery({
    id: invitation.id,
    sent: emailSent,
    error: emailError,
  });

  try {
    await logVentureActivity({
      venture_id: created.venture_id,
      action: "VENTURE_CREATED_ADMIN",
      actor_cid: actor?.cid || "sa",
      actor_name: actor?.name || "Super Admin",
      details: {
        company_name: created.company_name,
        founder_email: invitation.email,
        email_sent: emailSent,
      },
    });
  } catch (_) {}

  return {
    status: 200,
    body: {
      success: true,
      email_sent: emailSent,
      ...(emailError ? { email_error: emailError } : {}),
      venture: created,
    },
  };
}
