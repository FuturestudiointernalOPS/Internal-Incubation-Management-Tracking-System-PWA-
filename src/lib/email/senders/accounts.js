/**
 * Account emails: invitation, login, welcome, password reset
 *
 * Each one is a template plus a delivery. No logic of its own beyond the copy.
 *
 * Cut out of src/lib/email.js as-is: the bodies below are byte-identical to
 * the monolith's. Nothing decides anything here that the monolith did not
 * already decide; the split only moves each concern next to its own code.
 */

import { normalizeToHtml } from "@/models/platform/ai/email-personalize";
import { isGenericName, resolveGreetingName } from "../addresses";
import { APP_URL } from "../config";
import { sendAndRecord } from "../delivery";
import { FUTURE_STUDIO_FOOTER, applyTemplate } from "../templates";

export async function sendInviteEmail({ to, name, role, token, template, templateVars, programName, contact_cid }) {
  const activationUrl = `${APP_URL}/activate?token=${token}`;
  const roleLabel = role?.replace(/_/g, " ") || "User";
  const org = templateVars?.organization || "Impact OS";
  const greetingName = resolveGreetingName(name);
  const greeting = greetingName ? `Hello ${greetingName},` : "Hello,";
  const tv = { name: greetingName || "there", role: roleLabel, activation_link: activationUrl, organization: org, programName: programName || null, ...(templateVars || {}) };

  // Subject states what the email is about; it is not repeated in the body.
  const subject = template?.subject
    ? applyTemplate(template.subject, tv)
    : programName
      ? `You've been invited to facilitate ${programName}`
      : `You're invited to ${org}`;

  const bodyHtml = normalizeToHtml(
    template?.body
      ? applyTemplate(template.body, tv)
      : `<p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 8px;">${greeting}</p>
         <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">You have been selected to serve as a <strong style="color: #ff6600;">${roleLabel}</strong>${programName ? ` for <strong style="color: #f8fafc;">${programName}</strong>` : ""} on ${org}.</p>
         <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">Please use the button below to activate your account and set your password.</p>`
  );

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
                <span style="color: #ff6600;">Impact</span><span style="color: #f8fafc;"> OS</span>
              </h1>
              <p style="color: #64748b; font-size: 13px; margin: 0 0 24px;">Future Studio Platform</p>

              <h2 style="color: #f8fafc; font-size: 18px; margin: 0 0 8px;">${subject}</h2>
              ${bodyHtml}

              <table cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
                <tr>
                  <td align="center" style="background: #ff6600; border-radius: 12px; padding: 14px 32px;">
                    <a href="${activationUrl}" style="color: #000; text-decoration: none; font-size: 14px; font-weight: 800; letter-spacing: 0.5px;">
                      Activate My Account
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
              ${FUTURE_STUDIO_FOOTER}
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  return sendAndRecord({ to, subject, html, contact_cid, email_type: "activation" });
}

/**
 * Send an access email to someone who ALREADY has a platform account.
 * No password-setup token — the recipient logs in with existing credentials.
 */
export async function sendLoginEmail({ to, name, role, template, templateVars, programName, contact_cid }) {
  const loginUrl = `${APP_URL}/login`;
  const org = templateVars?.organization || "Impact OS";
  const greetingName = resolveGreetingName(name);
  const greeting = greetingName ? `Hello ${greetingName},` : "Hello,";
  const tv = { name: greetingName || "there", role: (role || "").replace(/_/g, " "), organization: org, login_url: loginUrl, programName: programName || null, ...(templateVars || {}) };

  const subject = template?.subject
    ? applyTemplate(template.subject, tv)
    : programName
      ? `You've been invited to facilitate ${programName}`
      : `Welcome back to ${org}`;

  const bodyHtml = normalizeToHtml(
    template?.body
      ? applyTemplate(template.body, tv)
      : `<p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 8px;">${greeting}</p>
         <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">You have been selected to serve as a <strong style="color: #ff6600;">${(role || "").replace(/_/g, " ")}</strong>${programName ? ` for <strong style="color: #f8fafc;">${programName}</strong>` : ""} on ${org}.</p>
         <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">Please use the button below to access your account.</p>`
  );

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
                <span style="color: #ff6600;">Impact</span><span style="color: #f8fafc;"> OS</span>
              </h1>
              <p style="color: #64748b; font-size: 13px; margin: 0 0 24px;">Future Studio Platform</p>

              <h2 style="color: #f8fafc; font-size: 18px; margin: 0 0 8px;">${subject}</h2>
              ${bodyHtml}

              <table cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
                <tr>
                  <td align="center" style="background: #ff6600; border-radius: 12px; padding: 14px 32px;">
                    <a href="${loginUrl}" style="color: #000; text-decoration: none; font-size: 14px; font-weight: 800; letter-spacing: 0.5px;">
                      Access Impact OS
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0 0 4px;">
                If the button doesn't work, copy and paste this URL into your browser:
              </p>
              <p style="color: #ff6600; font-size: 11px; word-break: break-all; margin: 0 0 24px;">
                ${loginUrl}
              </p>

              <hr style="border: none; border-top: 1px solid #1e293b; margin: 24px 0;" />
              <p style="color: #475569; font-size: 11px; line-height: 1.5; margin: 0;">
                If you did not expect this email, please ignore it.
              </p>
              ${FUTURE_STUDIO_FOOTER}
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  return sendAndRecord({ to, subject, html, contact_cid, email_type: "access" });
}

/**
 * Send a welcome email after activation
 */
export async function sendWelcomeEmail({ to, name, language, contact_cid }) {
  // Never render placeholder identities (UNKNOWN / Anonymous / empty) when a
  // resolved name is unavailable — use a neutral greeting instead.
  const displayName = isGenericName(name) ? "there" : (name || "there").trim();
  const isFr = (language || "en").toLowerCase().startsWith("fr");
  const copy = isFr
    ? {
        platform: "Plateforme Future Studio",
        heading: `Bienvenue, ${displayName} ! 👋`,
        body: "Votre compte est maintenant actif. Vous pouvez vous connecter et commencer à utiliser ImpactOS.",
        cta: "SE CONNECTER",
        note: "Si vous n'avez pas créé ce compte, veuillez contacter votre administrateur.",
        subject: "Bienvenue sur ImpactOS — Votre compte est actif",
      }
    : {
        platform: "Future Studio Platform",
        heading: `Welcome, ${displayName}! 👋`,
        body: "Your account is now active. You can log in and start using ImpactOS.",
        cta: "LOG IN",
        note: "If you did not create this account, please contact your administrator.",
        subject: "Welcome to ImpactOS — Your account is active",
      };
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
              <p style="color: #64748b; font-size: 13px; margin: 0 0 24px;">${copy.platform}</p>

              <h2 style="color: #f8fafc; font-size: 18px; margin: 0 0 8px;">${copy.heading}</h2>
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                ${copy.body}
              </p>

              <table cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
                <tr>
                  <td align="center" style="background: #ff6600; border-radius: 12px; padding: 14px 32px;">
                    <a href="${APP_URL}/login" style="color: #000; text-decoration: none; font-size: 14px; font-weight: 800; letter-spacing: 0.5px;">
                      ${copy.cta}
                    </a>
                  </td>
                </tr>
              </table>

              <hr style="border: none; border-top: 1px solid #1e293b; margin: 24px 0;" />
              <p style="color: #475569; font-size: 11px; line-height: 1.5; margin: 0;">
                ${copy.note}
              </p>
              ${FUTURE_STUDIO_FOOTER}
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  return sendAndRecord({ to, subject: copy.subject, html, provider: "gmail", contact_cid, email_type: "welcome" });
}

/**
 * Send a password reset email
 */
export async function sendPasswordResetEmail({ to, name, resetUrl, contact_cid }) {
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
                This link expires in <strong style="color: #f8fafc;">1 hour</strong>.
              </p>
              <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0 0 4px;">
                If you didn't request this, you can safely ignore this email.
              </p>

              <hr style="border: none; border-top: 1px solid #1e293b; margin: 24px 0;" />
              <p style="color: #475569; font-size: 11px; line-height: 1.5; margin: 0;">
                If you did not request a password reset, please ignore this email.
              </p>
              ${FUTURE_STUDIO_FOOTER}
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  return sendAndRecord({ to, subject: "Reset your ImpactOS password", html, contact_cid, email_type: "password_reset" });
}
