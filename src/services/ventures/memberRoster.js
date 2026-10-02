/**
 * services/ventures/memberRoster — what follows a Venture roster change.
 *
 * Moved verbatim out of `src/app/api/ventures/[id]/members/route.js` (lane L2).
 * The controller keeps the session, the access gates (checkAccess /
 * checkMutateAccess / archived Venture), the request validation (MEMBER_ROLES,
 * permissions), the writes and every response. This module runs what comes
 * after a write: delivering an invitation (in-app + email, delivery recorded),
 * dropping the remembered access answers, the membership history row and the
 * context-grant reconcile. Every step is best-effort and never blocks the answer.
 *
 * Same facades as the controller used, so route-level test mocks still apply.
 * No SQL, no HTTP.
 */
import { invalidateVentureAccess } from "@/lib/ventureAccessFacts";
import { sendVentureMemberInvitationEmail } from "@/lib/email";
import { resolveAppUrl } from "@/lib/appUrl";
import { recordVentureMemberInvitationDelivery } from "@/models/ventureMemberInvitations";
import { createLinkedNotification } from "@/models/workspace";

/**
 * Phase 6: reconcile a person's context grants after a membership write.
 * Never throws, never blocks the response.
 */
export async function applyContextGrants(cid) {
  if (!cid) return;
  try {
    const { syncContextGrantsForUser } = await import("@/services/authorization/contextGrants");
    await syncContextGrantsForUser(cid);
  } catch (_) {}
}

/**
 * Tells the invited person: in the app when they already have an account
 * (first send only), and by email always. The delivery outcome is recorded on
 * the invitation and returned, so the founder is told when no email left.
 *
 * @returns {Promise<{ emailSent: boolean, emailError: string|null }>}
 */
export async function deliverVentureMemberInvitation({ invitation, ventureName, memberType, inviterName }) {
  // Someone already on the platform is told IN THE APP too: they accept from
  // their notifications, without waiting on (or hunting for) the email. Only
  // on a first send — a re-send must not pile up duplicate notices.
  if (invitation.contact_id && invitation.contact_has_account && !invitation.resent) {
    try {
      const seat = memberType === "founder" ? "a founder" : "a team member";
      await createLinkedNotification(
        invitation.contact_id,
        `Invitation to join ${ventureName}`,
        `${inviterName || "A founder of the Venture"} invited you to join ${ventureName} as ${seat}. Open this notification to accept.`,
        "venture_invite",
        `/venture-invite/${invitation.token}`,
      );
    } catch (error) {
      console.warn("Venture invitation notification failed:", error.message);
    }
  }

  // Never block the answer on the mailer: a failed send is logged and the
  // invitation stays pending, so the founder can send it again. The delivery
  // outcome IS reported back, so the founder is told when no email actually
  // left the system instead of reading a success that never happened.
  let emailSent = false;
  let emailError = null;
  try {
    const link = `${resolveAppUrl()}/venture-invite/${invitation.token}`;
    // Same transport as every other Venture email (Google Workspace first,
    // Resend fallback) — not a separate weaker sender.
    const mailResult = await sendVentureMemberInvitationEmail({
      to: invitation.email,
      ventureName,
      inviterName: inviterName || null,
      memberType,
      inviteUrl: link,
      expiresAt: invitation.expires_at,
    });
    if (mailResult?.success) {
      emailSent = true;
    } else {
      emailError = mailResult?.error || mailResult?.note || "The email provider is not configured.";
      console.warn("[Venture Invitations] invitation email not delivered:", emailError);
    }
  } catch (error) {
    emailError = error.message;
    console.error("Venture member invitation email failed:", error.message);
  }

  // Persist the delivery outcome on the invitation so the pending list can
  // warn about it later, not only in the moment. Never blocks the answer.
  await recordVentureMemberInvitationDelivery({
    id: invitation.id,
    sent: emailSent,
    error: emailError,
  });

  return { emailSent, emailError };
}

/**
 * After a member was archived (removed): access dropped now, the membership
 * history row closed, the applied grants reconciled.
 */
export async function afterVentureMemberRemoved({ ventureParam, member, actorCid }) {
  const id = ventureParam;
  // The access answers remembered for this Venture are dropped here: a
  // removed member must lose access NOW, not when the window expires.
  invalidateVentureAccess(id);

  // Close the append-only membership history row (account/contact intact).
  try {
    const { syncVentureRoleHistory } = await import("@/models/contactIdentity");
    const removedRole = member.member_type === "founder" ? "founder" : member.role || "member";
    if (member.contact_id) {
      await syncVentureRoleHistory({
        contactCid: member.contact_id,
        ventureId: id,
        role: removedRole,
        active: false,
        actorCid: actorCid || null,
        notes: "member removed — account and CRM contact remain intact",
      });
    }
  } catch (_) {}

  // Phase 6: reconcile grants — if this was the last founder relationship,
  // the capability we applied is withdrawn (manual grants are untouched).
  await applyContextGrants(member.contact_id);
}

/**
 * After a member's role / permissions were updated: access answers dropped,
 * the history row written when the role changed, the grants reconciled.
 */
export async function afterVentureMemberUpdated({ ventureParam, memberContactId, role, actorCid }) {
  const id = ventureParam;
  // A changed role or permission set means the remembered answers for this
  // Venture are no longer the whole truth.
  invalidateVentureAccess(id);
  try {
    const { syncVentureRoleHistory } = await import("@/models/contactIdentity");
    if (memberContactId && role !== undefined) {
      await syncVentureRoleHistory({
        contactCid: memberContactId,
        ventureId: id,
        role: role || "member",
        active: true,
        actorCid: actorCid || null,
        notes: "member role updated",
      });
    }
  } catch (_) {}

  // Phase 6: a role change can turn a member into a founder (or back) —
  // reconcile the applied grants for the affected person.
  await applyContextGrants(memberContactId);
}
