/**
 * IMPACTOS EMAIL SERVICE
 *
 * Uses Resend for transactional emails (invites, activation, password reset).
 * Replace with your own sender domain/email in RESEND_FROM_EMAIL.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@impactos.dev";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Send an invite email with activation link
 */
export async function sendInviteEmail({ to, name, role, token }) {
  const activationUrl = `${APP_URL}/activate?token=${token}`;
  const roleLabel = role?.replace(/_/g, " ") || "User";

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

              <h2 style="color: #f8fafc; font-size: 18px; margin: 0 0 8px;">You're invited!</h2>
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 8px;">
                Hi <strong style="color: #f8fafc;">${name}</strong>,
              </p>
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                You've been invited to join ImpactOS as a <strong style="color: #ff6600;">${roleLabel}</strong>.
                Click the button below to set your password and activate your account.
              </p>

              <table cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
                <tr>
                  <td align="center" style="background: #ff6600; border-radius: 12px; padding: 14px 32px;">
                    <a href="${activationUrl}" style="color: #000; text-decoration: none; font-size: 14px; font-weight: 800; letter-spacing: 0.5px;">
                      ACTIVATE ACCOUNT
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0 0 4px;">
                This link expires in <strong style="color: #f8fafc;">48 hours</strong>.
              </p>
              <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0 0 4px;">
                If the button doesn't work, copy and paste this URL into your browser:
              </p>
              <p style="color: #ff6600; font-size: 11px; word-break: break-all; margin: 0 0 24px;">
                ${activationUrl}
              </p>

              <hr style="border: none; border-top: 1px solid #1e293b; margin: 24px 0;" />
              <p style="color: #475569; font-size: 11px; line-height: 1.5; margin: 0;">
                If you did not expect this invitation, please ignore this email.
              </p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({ to, subject: `You're invited to ImpactOS — ${roleLabel}`, html });
}

/**
 * Send a welcome email after activation
 */
export async function sendWelcomeEmail({ to, name, role }) {
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

              <h2 style="color: #f8fafc; font-size: 18px; margin: 0 0 8px;">Welcome, ${name}! 👋</h2>
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                Your account is now active. You can log in and start using ImpactOS.
              </p>

              <table cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
                <tr>
                  <td align="center" style="background: #ff6600; border-radius: 12px; padding: 14px 32px;">
                    <a href="${APP_URL}/login" style="color: #000; text-decoration: none; font-size: 14px; font-weight: 800; letter-spacing: 0.5px;">
                      LOG IN
                    </a>
                  </td>
                </tr>
              </table>

              <hr style="border: none; border-top: 1px solid #1e293b; margin: 24px 0;" />
              <p style="color: #475569; font-size: 11px; line-height: 1.5; margin: 0;">
                If you did not create this account, please contact your administrator.
              </p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({ to, subject: "Welcome to ImpactOS — Your account is active", html });
}

/**
 * Send a password reset email
 */
export async function sendPasswordResetEmail({ to, name, resetUrl }) {
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

              <h2 style="color: #f8fafc; font-size: 18px; margin: 0 0 8px;">Reset your password</h2>
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                Hi <strong style="color: #f8fafc;">${name}</strong>, we received a request to reset your password.
                Click the button below to set a new one.
              </p>

              <table cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
                <tr>
                  <td align="center" style="background: #ff6600; border-radius: 12px; padding: 14px 32px;">
                    <a href="${resetUrl}" style="color: #000; text-decoration: none; font-size: 14px; font-weight: 800; letter-spacing: 0.5px;">
                      RESET PASSWORD
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0 0 4px;">
                This link expires in <strong style="color: #f8fafc;">48 hours</strong>.
              </p>
              <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0 0 4px;">
                If you didn't request this, you can safely ignore this email.
              </p>

              <hr style="border: none; border-top: 1px solid #1e293b; margin: 24px 0;" />
              <p style="color: #475569; font-size: 11px; line-height: 1.5; margin: 0;">
                If you did not request a password reset, please ignore this email.
              </p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({ to, subject: "Reset your ImpactOS password", html });
}

/**
 * Internal: sends email via Resend
 */
async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.warn("Resend not configured — skipping email to:", to, "subject:", subject);
    return { success: false, note: "Resend API key not configured" };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(RESEND_API_KEY);

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (e) {
    console.error("Email send error:", e);
    return { success: false, error: e.message };
  }
}
