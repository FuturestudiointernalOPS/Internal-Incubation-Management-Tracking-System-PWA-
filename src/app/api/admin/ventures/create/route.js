import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { logVentureActivity } from "@/lib/ventures";
import { resolveAppUrl } from "@/lib/appUrl";
import { createAdminVenture } from "@/models/ventureAdmin";
import {
  createVentureMemberInvitation,
  recordVentureMemberInvitationDelivery,
} from "@/models/ventureMemberInvitations";
import { sendVentureFounderInvitationEmail } from "@/lib/email";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * POST /api/admin/ventures/create
 *
 * Super-admin fast-path: record a Venture by name and invite its founder in one
 * step. The Venture is created ACTIVE (an administrator vouches for it), and the
 * founder receives an invitation link where they either create their account
 * (a stranger to the platform) or accept as an existing user — either way they
 * become the Venture's founder with access to its workspace.
 *
 * This route never fabricates a founder ACCOUNT: it only ever emits an
 * invitation. The founder identity is resolved (never guessed) at acceptance.
 */
export const POST = createHandler({ roles: ["super_admin"] }, async (req) => {
  const body = await req.json().catch(() => ({}));
  const companyName = typeof body.company_name === "string" ? body.company_name.trim() : "";
  const founderEmail = typeof body.founder_email === "string" ? body.founder_email.trim() : "";

  if (companyName.length < 2) {
    return NextResponse.json(
      { success: false, error: "vadmin.list.addVentureNameRequired" },
      { status: 400 },
    );
  }
  if (!founderEmail) {
    return NextResponse.json(
      { success: false, error: "vadmin.list.addVentureEmailRequired" },
      { status: 400 },
    );
  }
  if (!EMAIL_RE.test(founderEmail)) {
    return NextResponse.json(
      { success: false, error: "vadmin.list.addVentureEmailInvalid" },
      { status: 400 },
    );
  }

  const created = await createAdminVenture({
    companyName,
    createdByCid: req.session?.cid || null,
  });
  if (created.conflict) {
    return NextResponse.json(
      { success: false, error: "vadmin.list.addVentureDuplicate" },
      { status: 409 },
    );
  }

  // The founder is invited, not written in: the invitation screen is where the
  // account is created and the membership is granted.
  const invitation = await createVentureMemberInvitation({
    ventureId: created.venture_id,
    email: founderEmail,
    memberType: "founder",
    invitedByCid: req.session?.cid || null,
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
      emailError = mailResult?.error || mailResult?.note || "The email provider is not configured.";
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
      actor_cid: req.session?.cid || "sa",
      actor_name: req.session?.name || "Super Admin",
      details: { company_name: created.company_name, founder_email: invitation.email, email_sent: emailSent },
    });
  } catch (_) {}

  return NextResponse.json({
    success: true,
    email_sent: emailSent,
    ...(emailError ? { email_error: emailError } : {}),
    venture: created,
  });
});
