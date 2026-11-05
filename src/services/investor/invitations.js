import { v4 as uuidv4 } from "uuid";

import { hashToken, ensureTokenHashColumns } from "@/lib/token-hashing";
import { sendStandaloneEmail } from "@/lib/email";
import { resolveAppUrl } from "@/lib/appUrl";
import {
  insertInvitation,
  listInvitations,
  getInvitationByTokenHash,
  getLatestInvitationByEmail,
  markInvitationOpened,
  markInvitationSubmitted,
  updateInvitationStatus,
} from "@/models/investor/invitations";
import { emitInvestorEvent } from "@/services/investor/activity";

const INVITE_TTL_DAYS = 30;

/**
 * Create an invitation and email it. Only the HASH of the token is stored, so a
 * database leak yields no usable link. The studio supplies the application URL
 * (`seedInvestorApplication` link); the token is appended to it.
 */
export async function createInvitation({ email, name, applicationUrl, session }) {
  if (!email) return { ok: false, status: 400, error: "email required" };

  await ensureTokenHashColumns();

  const token = uuidv4();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86400000).toISOString();

  const result = await insertInvitation({
    email,
    name,
    tokenHash,
    sentBy: session?.cid || session?.id || null,
    expiresAt,
  });
  const invitation = result.rows?.[0];

  const base = applicationUrl || `${resolveAppUrl()}/platform`;
  const separator = base.includes("?") ? "&" : "?";
  const link = `${base}${separator}invitation=${token}`;

  try {
    await sendStandaloneEmail({
      to: email,
      subject: "Future Studio — Investor invitation",
      email_type: "investor_invitation",
      contact_cid: null,
      body: `Hello ${name || ""},\n\nYou are invited to apply to the Future Studio investor network.\n\nOpen your invitation:\n${link}\n\nThis link expires in ${INVITE_TTL_DAYS} days.\n\n— Future Studio Team`,
    });
  } catch (_) {}

  await emitInvestorEvent({
    session,
    eventType: "invitation_sent",
    actorType: "studio",
    relatedId: invitation?.id ?? null,
    metadata: { email },
  });

  return { ok: true, invitation, link };
}

/** Validate an invitation link; mark it opened; never leak the token. */
export async function openInvitation({ token }) {
  if (!token) return { ok: false, status: 400, error: "token required" };

  const result = await getInvitationByTokenHash(hashToken(token));
  const invitation = result.rows?.[0];
  if (!invitation) return { ok: false, status: 404, error: "Invalid invitation." };
  if (invitation.status === "revoked") {
    return { ok: false, status: 410, error: "Invitation revoked." };
  }
  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    try {
      await updateInvitationStatus({ id: invitation.id, status: "expired" });
    } catch (_) {}
    return { ok: false, status: 410, error: "Invitation expired." };
  }

  if (!invitation.opened_at) {
    await markInvitationOpened(invitation.id);
  }

  return {
    ok: true,
    invitation: { id: invitation.id, email: invitation.email, name: invitation.name },
  };
}

/**
 * Record that the invited person submitted the application. Called from the
 * approval/intake automation once the submission's email is known. Idempotent.
 */
export async function markInvitationSubmittedByEmail({ email, submissionId = null }) {
  if (!email) return { ok: false };
  const result = await getLatestInvitationByEmail(email);
  const invitation = result.rows?.[0];
  if (!invitation || invitation.submitted_at) return { ok: true, marked: false };
  await markInvitationSubmitted({ id: invitation.id, submissionId });
  return { ok: true, marked: true, invitationId: invitation.id };
}

export async function listInvitationsForStudio({ status } = {}) {
  return { ok: true, invitations: (await listInvitations({ status })).rows };
}
