/**
 * Venture invitations
 *
 * Member and founder invitations: same transport, two copy sets.
 *
 * Cut out of src/lib/email.js as-is: the bodies below are byte-identical to
 * the monolith's. Nothing decides anything here that the monolith did not
 * already decide; the split only moves each concern next to its own code.
 */

import { APP_URL } from "../config";
import { sendAndRecord } from "../delivery";
import { FUTURE_STUDIO_FOOTER } from "../templates";

/**
 * Venture MEMBER invitation — a founder adding a teammate to an existing
 * Venture. Rides the SAME transport as every other Venture email (Google
 * Workspace first, Resend fallback), so it is no longer a separate weaker
 * sender that silently no-ops when one provider is unavailable.
 *
 * Returns the transport result unchanged: `success: false` means the email did
 * NOT leave the system and the caller must tell the founder.
 */
export async function sendVentureMemberInvitationEmail({
  to,
  ventureName,
  inviterName,
  memberType,
  inviteUrl,
  expiresAt,
  contact_cid,
}) {
  const ctaUrl = inviteUrl || `${APP_URL}/login`;
  const venue = ventureName || "the Venture";
  const seat = memberType === "founder" ? "a founder" : "a team member";
  const inviter = inviterName ? `<strong style="color: #f8fafc;">${inviterName}</strong>` : "A founder";
  const expiryLine = expiresAt
    ? `<p style="color: #64748b; font-size: 12px; margin: 0 0 24px;">This invitation link expires on ${new Date(expiresAt).toLocaleDateString("en-GB")}.</p>`
    : "";

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #020617; color: #f8fafc; margin: 0; padding: 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background: #020617;">
        <tr><td align="center" style="padding: 40px 20px;">
          <table width="480" cellpadding="0" cellspacing="0" style="background: #0f172a; border-radius: 16px; border: 1px solid #334155;">
            <tr><td style="padding: 40px;">
              <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">
                <span style="color: #ff6600;">Impact</span><span style="color: #f8fafc;">OS</span>
              </h1>
              <p style="color: #64748b; font-size: 13px; margin: 0 0 24px;">Future Studio Platform</p>

              <h2 style="color: #f8fafc; font-size: 18px; margin: 0 0 8px;">You're invited to join ${venue} 🤝</h2>
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                ${inviter} invited you to join <strong style="color: #f8fafc;">${venue}</strong> as ${seat}.
                Accept the invitation below to join the team.
              </p>

              <table cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
                <tr>
                  <td align="center" style="background: #ff6600; border-radius: 12px; padding: 14px 32px;">
                    <a href="${ctaUrl}" style="color: #000; text-decoration: none; font-size: 14px; font-weight: 800; letter-spacing: 0.5px;">
                      ACCEPT INVITATION
                    </a>
                  </td>
                </tr>
              </table>

              ${expiryLine}

              <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0 0 4px;">
                If the button doesn't work, copy and paste this URL into your browser:
              </p>
              <p style="color: #ff6600; font-size: 11px; word-break: break-all; margin: 0 0 24px;">
                ${ctaUrl}
              </p>

              <hr style="border: none; border-top: 1px solid #1e293b; margin: 24px 0;" />
              <p style="color: #475569; font-size: 11px; line-height: 1.5; margin: 0;">
                If you have any questions, please contact your administrator.
              </p>
              ${FUTURE_STUDIO_FOOTER}
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  return sendAndRecord({ to, subject: `You're invited to join ${venue}`, html, contact_cid, email_type: "venture_member_invitation" });
}

/**
 * VENTURE FOUNDER INVITATION — a Future Studio administrator has just recorded
 * a Venture and invites its founder to join ImpactOS.
 *
 * The link opens the invitation screen: a person the platform has never seen
 * sets a password (their account is created there) and becomes the Venture's
 * founder; someone who already has an account simply accepts. One link covers
 * both cases, which is why the copy speaks to both.
 *
 * Rides the same transport as every other Venture email and returns its result
 * unchanged — `success: false` means the email did NOT leave the system.
 */
export async function sendVentureFounderInvitationEmail({
  to,
  ventureName,
  inviteUrl,
  expiresAt,
  contact_cid,
}) {
  const ctaUrl = inviteUrl || `${APP_URL}/login`;
  const venue = ventureName || "your venture";
  const expiryLine = expiresAt
    ? `<p style="color: #64748b; font-size: 12px; margin: 0 0 24px;">This invitation link expires on ${new Date(expiresAt).toLocaleDateString("en-GB")}.</p>`
    : "";

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #020617; color: #f8fafc; margin: 0; padding: 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background: #020617;">
        <tr><td align="center" style="padding: 40px 20px;">
          <table width="480" cellpadding="0" cellspacing="0" style="background: #0f172a; border-radius: 16px; border: 1px solid #334155;">
            <tr><td style="padding: 40px;">
              <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">
                <span style="color: #ff6600;">Impact</span><span style="color: #f8fafc;">OS</span>
              </h1>
              <p style="color: #64748b; font-size: 13px; margin: 0 0 24px;">Future Studio Platform</p>

              <h2 style="color: #f8fafc; font-size: 18px; margin: 0 0 8px;">Your venture has been added to ImpactOS 🚀</h2>
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                Your company <strong style="color: #ff6600;">${venue}</strong> has been added to ImpactOS,
                and you are invited to join the platform. Create your account below to open your
                venture's workspace — or log in if you already have one.
              </p>

              <table cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
                <tr>
                  <td align="center" style="background: #ff6600; border-radius: 12px; padding: 14px 32px;">
                    <a href="${ctaUrl}" style="color: #000; text-decoration: none; font-size: 14px; font-weight: 800; letter-spacing: 0.5px;">
                      CREATE YOUR ACCOUNT &amp; JOIN
                    </a>
                  </td>
                </tr>
              </table>

              ${expiryLine}

              <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0 0 4px;">
                If the button doesn't work, copy and paste this URL into your browser:
              </p>
              <p style="color: #ff6600; font-size: 11px; word-break: break-all; margin: 0 0 24px;">
                ${ctaUrl}
              </p>

              <hr style="border: none; border-top: 1px solid #1e293b; margin: 24px 0;" />
              <p style="color: #475569; font-size: 11px; line-height: 1.5; margin: 0;">
                If you have any questions, please contact your administrator.
              </p>
              ${FUTURE_STUDIO_FOOTER}
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  return sendAndRecord({ to, subject: `Your venture ${venue} has been added to ImpactOS`, html, contact_cid, email_type: "venture_founder_invitation" });
}
