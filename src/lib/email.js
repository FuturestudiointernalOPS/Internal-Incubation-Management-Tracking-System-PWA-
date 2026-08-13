/**
 * IMPACTOS EMAIL SERVICE
 *
 * Uses Resend for transactional emails (invites, activation, password reset).
 * Replace with your own sender domain/email in RESEND_FROM_EMAIL.
 */

import { normalizeToHtml } from "@/lib/platform/ai/email-personalize";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@impactos.futurestudio.bj";
const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
const APP_URL = (typeof rawAppUrl === "string" ? rawAppUrl : "http://localhost:3000").replace(/\/login.*$/i, "").replace(/\/$/, "");

// ─── GMAIL WORKSPACE TRANSPORT (decision/approval emails) ─────────────
// Approval/rejection emails go through the Google Workspace mailbox so the
// platform can exceed Resend's free-tier daily limit. Activation emails keep
// using Resend. From/Reply-To are fixed to the official mailbox; the
// recipient is always dynamic.

const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
const GMAIL_REDIRECT_URI = process.env.GMAIL_REDIRECT_URI;
const GMAIL_SENDER_EMAIL = process.env.GMAIL_SENDER_EMAIL || "info@futurestudio.bj";
const GMAIL_SENDER_NAME = "Future Studio";

/**
 * Shared, application-controlled email footer. Appended by the senders AFTER
 * template personalization so the AI can never remove or modify it.
 */
export const FUTURE_STUDIO_FOOTER = `
  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;font-size:12px;line-height:1.6;color:#94a3b8;">
    <strong style="color:#f8fafc;">Future Studio</strong> —
    <a href="https://futurestudio.bj" style="color:#f97316;text-decoration:none;font-weight:700;">futurestudio.bj</a>
  </div>`;

// Decision emails default to Gmail when credentials exist; override with
// DECISION_EMAIL_PROVIDER=resend if needed. Activation stays on Resend.
const DECISION_EMAIL_DEFAULT =
  process.env.DECISION_EMAIL_PROVIDER ||
  (GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REFRESH_TOKEN ? "gmail" : "resend");

function gmailCredentialsAvailable() {
  return !!(GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REFRESH_TOKEN);
}

/** Map provider errors to safe, non-sensitive categories (never echo raw details). */
function classifyGmailError(err) {
  const msg = String(err?.message || err?.response?.data?.error || "").toLowerCase();
  if (msg.includes("invalid_grant")) return "refresh_token_invalid_or_revoked";
  if (msg.includes("invalid_client")) return "client_id_or_secret_invalid";
  if (msg.includes("access_denied") || msg.includes("insufficient") || msg.includes("forbidden"))
    return "permission_or_scope_denied";
  if (msg.includes("quota") || msg.includes("rate")) return "quota_or_rate_limit";
  if (msg.includes("daily limit")) return "daily_send_limit_reached";
  if (msg.includes("delegation") || msg.includes("send-as")) return "sender_identity_not_authorized";
  if (msg.includes("enabled") || msg.includes("not found") || msg.includes("404")) return "gmail_api_not_enabled";
  return "unknown_error";
}

/** RFC 2047 encode headers containing non-ASCII characters (e.g. French subjects). */
function encodeMailHeader(value) {
  if (!value) return "";
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

/** Build a raw MIME message (multipart/alternative) for the Gmail API. */
function buildGmailRawMessage({ to, subject, html }) {
  const plainText = (html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 4000);
  const boundary = `futurestudio_mix_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const message = [
    `From: ${GMAIL_SENDER_NAME} <${GMAIL_SENDER_EMAIL}>`,
    `Reply-To: ${GMAIL_SENDER_EMAIL}`,
    `To: ${to}`,
    `Subject: ${encodeMailHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(plainText, "utf8").toString("base64"),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(html || plainText, "utf8").toString("base64"),
    `--${boundary}--`,
  ].join("\n");
  return Buffer.from(message, "utf8").toString("base64url");
}

/** Send one email through the Google Workspace (Gmail API) transport. */
async function sendViaGmail({ to, subject, html }) {
  if (!gmailCredentialsAvailable()) {
    console.warn("[Gmail] Credentials not configured — skipping Gmail send to:", to);
    return { success: false, provider: "gmail", note: "Gmail credentials not configured" };
  }

  try {
    const { google } = await import("googleapis");
    const auth = new google.auth.OAuth2(
      GMAIL_CLIENT_ID,
      GMAIL_CLIENT_SECRET,
      GMAIL_REDIRECT_URI || "https://developers.google.com/oauthplayground"
    );
    auth.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });

    const gmail = google.gmail({ version: "v1", auth });
    const raw = buildGmailRawMessage({ to, subject, html });
    const sendRes = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });

    return { success: true, provider: "gmail", data: { id: sendRes.data?.id || null } };
  } catch (e) {
    console.error("[Gmail] Send error:", classifyGmailError(e));
    return { success: false, provider: "gmail", error: classifyGmailError(e) };
  }
}

// ─── TEMPLATE ENGINE ────────────────────────────────────────────────

const DEFAULT_TEMPLATES = {
  acknowledgement: {
    subject: "Thank you for your submission — {{form_name}}",
    body: `<p>Hello {{name}},</p><p>We have received your submission for <strong>{{form_name}}</strong>.</p><p>Our team will review it and get back to you soon.</p>`,
  },
  approval: {
    subject: "Your {{form_name}} application has been approved",
    body: `<p>Congratulations {{name}}!</p><p>Your application for <strong>{{form_name}}</strong> has been approved.</p><p>We are excited to welcome you.</p>`,
  },
  rejection: {
    subject: "Update on your {{form_name}} application",
    body: `<p>Dear {{name}},</p><p>Thank you for your interest in <strong>{{form_name}}</strong>.</p><p>Unfortunately, you were not selected this time. We encourage you to apply again in the future.</p>`,
  },
  activation: {
    subject: "Welcome to {{organization}} — Set Your Password",
    body: `<p>Hello {{name}},</p><p>Your account has been created on <strong>{{organization}}</strong>.</p><p>Click the button below to create your password and access your dashboard.</p>`,
  },
  existing_user: {
    subject: "Welcome back to {{organization}} — Log In",
    body: `<p>Hello {{name}},</p><p>You already have an account with us. You can access the platform using your existing login credentials.</p>`,
  },
};

/**
 * Replace {{variables}} in a template string with provided values.
 * Falls back gracefully for missing values.
 */
export function applyTemplate(text, vars = {}) {
  if (!text) return "";
  let result = text;
  for (const [key, val] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val != null ? String(val) : "");
  }
  return result;
}

/**
 * Resolve a template with a run-level override chain:
 * run.settings.templates[key] → form.settings.automation.templates[key] → DEFAULT_TEMPLATES.
 * Blank (empty/whitespace) values fall through to the next level, so an
 * empty run-level field can never shadow a designed form-level template
 * (the UI promises "Empty = use the form template, then the platform default").
 */
export function getTemplate(formSettings, templateKey, runSettings) {
  const custom = formSettings?.automation?.templates?.[templateKey] || {};
  const runCustom = runSettings?.templates?.[templateKey] || {};
  const text = (v) => (typeof v === "string" ? v.trim() : v);
  // Per-field fallthrough: run value (non-blank) → form value (non-blank) → default
  const pick = (runVal, formVal) => text(runVal) || text(formVal) || "";
  const def = DEFAULT_TEMPLATES[templateKey];
  return {
    subject: pick(runCustom.subject, custom.subject) || def?.subject || "",
    body: pick(runCustom.body, custom.body) || def?.body || "",
  };
}

/**
 * The platform's built-in template for a key (used as the base structure
 * when AI personalization runs on an empty draft).
 */
export function getDefaultTemplate(templateKey) {
  const def = DEFAULT_TEMPLATES[templateKey];
  return { subject: def?.subject || "", body: def?.body || "" };
}

/**
 * Send an invite email with activation link
 */
export async function sendInviteEmail({ to, name, role, token, template, templateVars }) {
  const activationUrl = `${APP_URL}/activate?token=${token}`;
  const roleLabel = role?.replace(/_/g, " ") || "User";
  const org = templateVars?.organization || "ImpactOS";
  const tv = { name: name || "there", role: roleLabel, activation_link: activationUrl, organization: org, ...(templateVars || {}) };

  // Use template subject if provided, otherwise default
  const subject = template?.subject
    ? applyTemplate(template.subject, tv)
    : `You're invited to ${org} — Set Your Password`;

  // Template body or default
  const bodyHtml = normalizeToHtml(
    template?.body
      ? applyTemplate(template.body, tv)
      : `<p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 8px;">Hi <strong style="color: #f8fafc;">${tv.name}</strong>,</p>
       <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">You've been invited to join ${org} as a <strong style="color: #ff6600;">${roleLabel}</strong>. Click the button below to set your password and activate your account.</p>`
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
                <span style="color: #ff6600;">Impact</span><span style="color: #f8fafc;">OS</span>
              </h1>
              <p style="color: #64748b; font-size: 13px; margin: 0 0 24px;">Future Studio Platform</p>

              <h2 style="color: #f8fafc; font-size: 18px; margin: 0 0 8px;">${subject}</h2>
              ${bodyHtml}

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
              ${FUTURE_STUDIO_FOOTER}
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
 * Send an access email to someone who ALREADY has a platform account.
 * No password-setup token — the recipient logs in with existing credentials.
 */
export async function sendLoginEmail({ to, name, role, template, templateVars }) {
  const loginUrl = `${APP_URL}/login`;
  const org = templateVars?.organization || "ImpactOS";
  const tv = { name: name || "there", role: (role || "").replace(/_/g, " "), organization: org, login_url: loginUrl, ...(templateVars || {}) };

  const subject = template?.subject
    ? applyTemplate(template.subject, tv)
    : `Welcome back to ${org} — Log In`;

  const bodyHtml = normalizeToHtml(
    template?.body
      ? applyTemplate(template.body, tv)
      : `<p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 8px;">Hello <strong style="color: #f8fafc;">${tv.name}</strong>,</p>
       <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">You already have an account with us. Use your existing credentials to log in and access the platform.</p>`
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
                <span style="color: #ff6600;">Impact</span><span style="color: #f8fafc;">OS</span>
              </h1>
              <p style="color: #64748b; font-size: 13px; margin: 0 0 24px;">Future Studio Platform</p>

              <h2 style="color: #f8fafc; font-size: 18px; margin: 0 0 8px;">${subject}</h2>
              ${bodyHtml}

              <table cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
                <tr>
                  <td align="center" style="background: #ff6600; border-radius: 12px; padding: 14px 32px;">
                    <a href="${loginUrl}" style="color: #000; text-decoration: none; font-size: 14px; font-weight: 800; letter-spacing: 0.5px;">
                      LOGIN TO YOUR ACCOUNT
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

  return sendEmail({ to, subject, html });
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
              ${FUTURE_STUDIO_FOOTER}
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
              ${FUTURE_STUDIO_FOOTER}
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
 * Send a venture approval email (venture created via invite link has been approved).
 * Includes a setup link so the founder can set their password and access the dashboard.
 */
export async function sendVentureApprovalEmail({ to, name, ventureName, setupUrl }) {
  const ctaUrl = setupUrl || `${APP_URL}/login`;
  const ctaLabel = setupUrl ? "SET YOUR PASSWORD" : "LOG IN";
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

              <h2 style="color: #f8fafc; font-size: 18px; margin: 0 0 8px;">Your venture has been approved! 🎉</h2>
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 8px;">
                Hi <strong style="color: #f8fafc;">${name}</strong>,
              </p>
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                Great news — your venture <strong style="color: #ff6600;">${ventureName}</strong> has been
                <strong style="color: #f8fafc;">approved</strong> and is now active on Venture OS.
                ${setupUrl ? "Set your password below to access your dashboard." : "You can log in and start building."}
              </p>

              <table cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
                <tr>
                  <td align="center" style="background: #ff6600; border-radius: 12px; padding: 14px 32px;">
                    <a href="${ctaUrl}" style="color: #000; text-decoration: none; font-size: 14px; font-weight: 800; letter-spacing: 0.5px;">
                      ${ctaLabel}
                    </a>
                  </td>
                </tr>
              </table>

              ${setupUrl ? `
              <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0 0 4px;">
                This link expires in <strong style="color: #f8fafc;">48 hours</strong>.
              </p>
              <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0 0 4px;">
                If the button doesn't work, copy and paste this URL into your browser:
              </p>
              <p style="color: #ff6600; font-size: 11px; word-break: break-all; margin: 0 0 24px;">
                ${ctaUrl}
              </p>` : ""}

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

  return sendEmail({ to, subject: `Your venture ${ventureName} has been approved`, html });
}

/**
 * Internal: sends email via Resend
 */
async function sendViaResend({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.warn("Resend not configured — skipping email to:", to, "subject:", subject);
    return { success: false, provider: "resend", note: "Resend API key not configured" };
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
      return { success: false, provider: "resend", error };
    }

    return { success: true, provider: "resend", data };
  } catch (e) {
    console.error("Email send error:", e);
    return { success: false, provider: "resend", error: e.message };
  }
}

/**
 * Internal: single dispatch point for outgoing email.
 *
 * Provider selection:
 *  - "gmail" → Google Workspace transport (approval/decision emails)
 *  - otherwise → Resend (activation, invites, password resets)
 *
 * Decision emails default to Gmail (configurable via DECISION_EMAIL_PROVIDER)
 * and fall back to Resend on transport failure so the applicant still
 * receives the notification — it remains a single tracked attempt.
 */
async function sendEmail({ to, subject, html, provider }) {
  // HARD GUARD: an internal placeholder address (import-…@placeholder…,
  // .local, example.com…) must NEVER leave the system, no matter which
  // code path built the recipient. This is the final safety net before any
  // provider is called.
  if (isPlaceholderEmail(to)) {
    console.warn("[Email] REFUSING to send to placeholder address:", to);
    return { success: false, provider: "blocked", error: "Refused — placeholder address is not a real recipient" };
  }

  const chosen = provider || "resend";
  if (chosen === "gmail") {
    const gmailResult = await sendViaGmail({ to, subject, html });
    if (gmailResult.success || !RESEND_API_KEY) return gmailResult;
    console.warn("[Email] Gmail transport failed — falling back to Resend:", gmailResult.error);
    const resendResult = await sendViaResend({ to, subject, html });
    return { ...resendResult, provider: resendResult.success ? "resend" : "gmail" };
  }
  return sendViaResend({ to, subject, html });
}

// ─── EMAIL DELIVERY LOG (idempotency layer) ─────────────────────────
// Every workflow email is tracked in platform_email_log so the system
// never sends the same email type twice for the same submission, and
// failed sends are distinguishable from successful ones.

async function ensureEmailLogTable() {
  try {
    const { default: db, initDb } = await import("@/lib/db");
    await initDb();
    await db.execute(`CREATE TABLE IF NOT EXISTS platform_email_log (
      id SERIAL PRIMARY KEY,
      submission_id INTEGER,
      contact_cid TEXT,
      email_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      sent_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    await db.execute(`ALTER TABLE platform_email_log ADD COLUMN IF NOT EXISTS provider TEXT`);
    await db.execute(`ALTER TABLE platform_email_log ADD COLUMN IF NOT EXISTS recipient TEXT`);
    await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_email_log_once
      ON platform_email_log (submission_id, email_type)
      WHERE status = 'sent'`);
    return true;
  } catch (e) {
    console.warn("[EmailLog] Could not ensure table:", e.message);
    return false;
  }
}

export async function getEmailLogRow(submissionId, emailType) {
  if (!submissionId) return null;
  try {
    await ensureEmailLogTable();
    const { default: db } = await import("@/lib/db");
    const res = await db.execute({
      sql: "SELECT * FROM platform_email_log WHERE submission_id = ? AND email_type = ? ORDER BY id DESC LIMIT 1",
      args: [parseInt(submissionId), emailType],
    });
    return res.rows[0] || null;
  } catch (_) {
    return null;
  }
}

/**
 * RECIPIENT-LEVEL IDEMPOTENCY — when the same person appears in multiple
 * submissions of the same run (duplicate email), only ONE email of a given
 * type is ever sent to their address. Returns true when an email of that
 * type has already been successfully sent to this recipient for this run,
 * regardless of which submission it was attached to.
 */
export async function hasSentEmailToRecipientInRun({ run_id, email_type, recipient }) {
  if (!run_id || !recipient) return false;
  try {
    await ensureEmailLogTable();
    const { default: db } = await import("@/lib/db");
    const res = await db.execute({
      sql: `SELECT 1
            FROM platform_email_log el
            JOIN platform_form_submissions s ON el.submission_id = s.id
            WHERE s.run_id = ? AND el.email_type = ? AND el.status = 'sent'
              AND LOWER(el.recipient) = LOWER(?)
            LIMIT 1`,
      args: [parseInt(run_id), email_type, String(recipient).trim()],
    });
    return res.rows.length > 0;
  } catch (_) {
    return false;
  }
}

/**
 * Ensure password_setup_tokens exists with the CORRECT shape and repair
 * environments where `used` was created as BOOLEAN. A boolean `used` breaks
 * every "used = 0/1" write with Postgres error
 * "column 'used' is boolean but expression is of type integer" — which is
 * what makes activation emails fail while approval emails still work.
 * Idempotent: safe to call on every activation send.
 */
export async function ensurePasswordSetupTokensSchema() {
  try {
    const { default: db } = await import("@/lib/db");
    await db.execute(`CREATE TABLE IF NOT EXISTS password_setup_tokens (
      id SERIAL PRIMARY KEY,
      contact_cid TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    // Repair tables created by the LEGACY script (user_cid/user_email NOT NULL,
    // used BOOLEAN). The app writes contact_cid + integer used; legacy NOT NULL
    // columns without defaults otherwise break every insert.
    await db.execute(`ALTER TABLE password_setup_tokens ADD COLUMN IF NOT EXISTS contact_cid TEXT`);
    try {
      await db.execute(`ALTER TABLE password_setup_tokens ALTER COLUMN user_cid DROP NOT NULL`);
    } catch (_) {}
    try {
      await db.execute(`ALTER TABLE password_setup_tokens ALTER COLUMN user_email DROP NOT NULL`);
    } catch (_) {}
    try {
      await db.execute(`UPDATE password_setup_tokens SET contact_cid = user_cid WHERE contact_cid IS NULL AND user_cid IS NOT NULL`);
    } catch (_) {}
    await db.execute(`DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'password_setup_tokens' AND column_name = 'used' AND data_type = 'boolean'
      ) THEN
        ALTER TABLE password_setup_tokens ALTER COLUMN used DROP DEFAULT;
        ALTER TABLE password_setup_tokens ALTER COLUMN used TYPE INTEGER USING CASE WHEN used THEN 1 ELSE 0 END;
        ALTER TABLE password_setup_tokens ALTER COLUMN used SET DEFAULT 0;
      END IF;
    END $$`);
    return true;
  } catch (e) {
    console.warn("[TokenSchema] Could not ensure password_setup_tokens schema:", e.message);
    return false;
  }
}

/**
 * Artificial/placeholder addresses (import fallbacks, reserved domains) must
 * never be treated as real recipients.
 */
export function isPlaceholderEmail(email) {
  if (!email || typeof email !== "string") return true;
  const e = email.trim().toLowerCase();
  if (!e.includes("@")) return true;
  if (e.includes("placeholder")) return true;
  if (e.includes("@example.") || e.includes("@test.") || e.endsWith(".local") || e.endsWith(".invalid")) return true;
  if (e.startsWith("import-")) return true; // import-generated placeholder pattern
  return false;
}

/**
 * Resolve the real applicant email for a submission:
 *   1. a real email answer from the form response (label-aware: Email,
 *      E-mail, Courriel, Adresse e-mail… — no hardcoded single label)
 *   2. any other real email-looking value in the submission data
 *   3. the CRM/contact email (verified, only when it is not a placeholder)
 * Internal placeholder addresses (import-…@placeholder…, .local, example.com)
 * are NEVER returned. Empty string when nothing real exists.
 * Used by the Run Overview display, CSV export, decision emails and scores —
 * the UI and the email-sending workflow always agree on the recipient.
 */
export function resolveSubmissionEmail({ submissionData, fieldLabels, contactEmail }) {
  const data = submissionData && typeof submissionData === "object" ? submissionData : {};
  const labelOf = (k) => {
    const raw =
      fieldLabels && fieldLabels[String(k)] != null
        ? String(fieldLabels[String(k)])
        : String(k);
    return raw.toLowerCase().trim();
  };
  const isReal = (v) =>
    typeof v === "string" && v.includes("@") && !isPlaceholderEmail(v);
  // English + French email question labels (Email, E-mail, Email Address,
  // Adresse e-mail, Courriel, Mel…). Never matches a bare "Adresse" field.
  const EMAIL_HINTS = /(e-?mail|courriel|mel|adresse\s*(e-?mail|mail))/i;

  const labeled = [];
  const anyReal = [];
  for (const [k, v] of Object.entries(data)) {
    const val = typeof v === "string" ? v.trim() : "";
    if (!isReal(val)) continue;
    if (EMAIL_HINTS.test(labelOf(k))) labeled.push(val);
    else anyReal.push(val);
  }
  if (labeled.length > 0) return labeled[0].toLowerCase();
  if (anyReal.length > 0) return anyReal[0].toLowerCase();
  if (isReal(contactEmail)) return String(contactEmail).trim().toLowerCase();
  return "";
}

/**
 * Alias kept for the activation flow — the single source of truth is
 * resolveSubmissionEmail above (label-aware, placeholder-safe, EN/FR).
 */
export function resolveRecipientEmail({ contactEmail, submissionData, fieldLabels }) {
  return resolveSubmissionEmail({ submissionData, fieldLabels, contactEmail });
}

const GENERIC_NAMES = /^(unknown|anonymous|n\/a|none|participant|null|undefined|\-+|\s*)$/i;

/** True when a value is a placeholder rather than a real person name. */
export function isGenericName(v) {
  return GENERIC_NAMES.test(typeof v === "string" ? v.trim() : "");
}

// Explicit full-name fields (strongest submission signal). Intentionally
// excludes the bare "name"/"nom" field so "Full Name"/"Nom complet" always
// wins over the shorter fields.
const FULL_NAME_HINTS = /^(full\s*name|fullname|nom\s+complet|prenom\s*et\s*nom|prénom\s*et\s*nom|nom\s*et\s*pr[eé]nom|nom\s*&\s*pr[eé]nom)$/i;
const FIRST_NAME_HINTS = /(first|given|pr[eé]nom|prenom)/i;
const LAST_NAME_HINTS = /(last|surname|family)/i;
// Bare French "Nom" / "Nom de famille" is a LAST name (combined with "Prénom").
const FR_LAST_NAME_HINTS = /^(nom|nom\s+de\s+famille)$/i;
// Bare English "Name" is treated as a full-name field.
const NAME_HINTS = /^(name)$/i;

/**
 * Resolve the best real person name deterministically (application code
 * resolves identity — the AI never has to guess who the applicant is).
 *
 * Priority (per product directive):
 *   1. CRM verified full name (contacts.name)
 *   2. Full-name field from the submission
 *   3. CRM first (+ last) name when stored separately
 *   4. First-name field from the submission (combined with its last name)
 *   5. Other recognized name field (bare "Name")
 *   6. Stored submission submitter_name
 *   7. Any other name-ish answer
 *   8. "" — the caller decides the neutral fallback
 *
 * Language-aware: English and French labels are understood as equivalent
 * semantic fields (Full Name / Nom complet, First Name / Prénom).
 *
 * `fieldLabels` maps a submission data KEY (usually the numeric field id)
 * to the actual question label — without it, label hints can never match
 * and form answers are effectively invisible to name resolution.
 *
 * Placeholder values (Unknown / Anonymous / N/A / ...) are never returned
 * when a real name exists anywhere.
 */
export function resolvePersonName({ contactName, contactFirstName, contactLastName, submitterName, submissionData, fieldLabels }) {
  const clean = (v) =>
    typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";

  const data = submissionData && typeof submissionData === "object" ? submissionData : {};
  const stringify = (v) => {
    if (typeof v !== "string") return "";
    try {
      if (v.startsWith("{") && v.includes('"code"')) return ""; // phone objects
    } catch (_) {}
    return v;
  };
  // Effective label for a data key: field id → real question label.
  const labelOf = (k) => {
    const raw =
      fieldLabels && fieldLabels[String(k)] != null
        ? String(fieldLabels[String(k)])
        : String(k);
    return raw.toLowerCase().trim();
  };

  const fullNames = [];
  const firstNames = [];
  const lastNames = [];
  let bareName = "";

  for (const [k, v] of Object.entries(data)) {
    const val = clean(stringify(v));
    if (!val) continue;
    const label = labelOf(k);
    if (!label) continue;
    if (FULL_NAME_HINTS.test(label)) fullNames.push(val);
    else if (FIRST_NAME_HINTS.test(label)) firstNames.push(val);
    else if (LAST_NAME_HINTS.test(label) || FR_LAST_NAME_HINTS.test(label)) lastNames.push(val);
    else if (NAME_HINTS.test(label)) bareName = bareName || val;
  }

  const candidates = [];

  // 1. CRM verified full name
  if (clean(contactName)) candidates.push(clean(contactName));

  // 2. Submission full-name field(s)
  for (const n of fullNames) candidates.push(n);

  // 3. CRM first (+ last) name when stored separately
  const crmFirst = clean(contactFirstName);
  const crmLast = clean(contactLastName);
  if (crmFirst || crmLast) candidates.push(`${crmFirst} ${crmLast}`.trim());

  // 4. Submission first-name field, combined with its last name when present
  if (firstNames.length > 0) {
    candidates.push(`${firstNames[0]} ${lastNames[0] || ""}`.trim());
  } else if (lastNames.length > 0) {
    candidates.push(lastNames[0]);
  }

  // 5. Other recognized name field (bare English "Name")
  if (bareName) candidates.push(bareName);

  // 6. Stored submission submitter_name
  if (clean(submitterName)) candidates.push(clean(submitterName));

  // 7. Any remaining name-ish answer (label or key contains name words)
  for (const [k, v] of Object.entries(data)) {
    const key = labelOf(k);
    const val = clean(stringify(v));
    if (!val || !key) continue;
    if (key.includes("name") || key.includes("nom") || key.includes("prénom") || key.includes("prenom")) {
      candidates.push(val);
    }
  }

  for (const c of candidates) {
    if (c && !GENERIC_NAMES.test(c)) return c;
  }
  return "";
}

/**
 * Map account state to the kind of email to send:
 *  - no account                    → "create_activate"
 *  - account exists, not activated → "activate_existing"
 *  - account exists AND activated  → "login_existing"
 */
export function decideEmailKind({ accountExists, accountActivated }) {
  if (!accountExists) return "create_activate";
  return accountActivated ? "login_existing" : "activate_existing";
}

/**
 * Record a workflow email status row (skipped/failed) with a human-readable
 * reason so the dashboard shows WHY an expected email never fired. Deduped:
 * no new row is written when the latest row already has the same status.
 */
export async function recordEmailStatus({ submission_id, contact_cid, email_type, status, error, provider, to }) {
  try {
    await ensureEmailLogTable();
    const { default: db } = await import("@/lib/db");
    const safeStatus = status === "skipped" ? "skipped" : "failed";
    if (submission_id) {
      const latest = await db.execute({
        sql: "SELECT status, error FROM platform_email_log WHERE submission_id = ? AND email_type = ? ORDER BY id DESC LIMIT 1",
        args: [parseInt(submission_id), email_type],
      });
      const last = latest.rows[0];
      if (last && last.status === safeStatus) return; // already recorded — no spam
    }
    await db.execute({
      sql: `INSERT INTO platform_email_log (submission_id, contact_cid, email_type, status, provider, error, recipient)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [submission_id ? parseInt(submission_id) : null, contact_cid || null, email_type, safeStatus, provider || null, (error || "Unknown reason").substring(0, 500), to ? String(to).trim().substring(0, 300) : null],
    });
  } catch (e) {
    console.warn("[EmailLog] Could not record status:", e.message);
  }
}

/** Record a hard failure (status 'failed') with a reason. */
export async function recordEmailFailure(args) {
  return recordEmailStatus({ ...args, status: "failed" });
}

async function recordEmailResult({ submission_id, contact_cid, email_type, success, error, provider, note, to }) {
  try {
    await ensureEmailLogTable();
    const { default: db } = await import("@/lib/db");
    const recipient = to ? String(to).trim().substring(0, 300) : null;
    if (success) {
      await db.execute({
        sql: `INSERT INTO platform_email_log (submission_id, contact_cid, email_type, status, provider, error, recipient, sent_at)
              VALUES (?, ?, ?, 'sent', ?, ?, ?, NOW())
              ON CONFLICT (submission_id, email_type) WHERE status = 'sent' DO NOTHING`,
        args: [submission_id ? parseInt(submission_id) : null, contact_cid || null, email_type, provider || null, note || null, recipient],
      });
    } else {
      await db.execute({
        sql: `INSERT INTO platform_email_log (submission_id, contact_cid, email_type, status, provider, error, recipient)
              VALUES (?, ?, ?, 'failed', ?, ?, ?)`,
        args: [submission_id ? parseInt(submission_id) : null, contact_cid || null, email_type, provider || null, (error || "Unknown error").substring(0, 500), recipient],
      });
    }
  } catch (e) {
    console.warn("[EmailLog] Could not record:", e.message);
  }
}

/**
 * Send a workflow email exactly once per (submission_id, email_type).
 * - Already sent → returns { skipped: true } without sending
 * - Send succeeds → records 'sent' and returns { success: true }
 * - Send fails → records 'failed' and returns { success: false } (retryable)
 */
export async function sendTrackedEmail({ submission_id, contact_cid, email_type, sendFn, provider, note, to }) {
  const existing = await getEmailLogRow(submission_id, email_type);
  if (existing && existing.status === "sent") {
    return { skipped: true, already_sent: true, log: existing };
  }

  let result;
  try {
    result = await sendFn();
  } catch (e) {
    result = { success: false, error: e?.message || "Send failed" };
  }

  await recordEmailResult({
    submission_id,
    contact_cid,
    email_type,
    success: !!result.success,
    error: result.error ? (typeof result.error === "string" ? result.error : JSON.stringify(result.error)) : undefined,
    provider: result?.provider || provider,
    note,
    to,
  });

  return { ...result, skipped: false };
}

/**
 * Email delivery stats for a form (dashboard visibility).
 */
export async function getEmailStatsForForm(formId) {
  try {
    await ensureEmailLogTable();
    const { default: db } = await import("@/lib/db");
    const res = await db.execute({
      sql: `SELECT el.email_type, el.status, COUNT(*)::int AS cnt
            FROM platform_email_log el
            JOIN platform_form_submissions s ON el.submission_id = s.id
            JOIN platform_form_runs r ON s.run_id = r.id
            WHERE r.form_id = ?
            GROUP BY el.email_type, el.status`,
      args: [parseInt(formId)],
    });
    const stats = { sent: 0, failed: 0, pending: 0, activation_sent: 0, approval_sent: 0 };
    for (const row of res.rows) {
      if (row.status === "sent") stats.sent += row.cnt;
      if (row.status === "failed") stats.failed += row.cnt;
      if (row.status === "pending") stats.pending += row.cnt;
      if (row.status === "sent" && row.email_type === "activation") stats.activation_sent += row.cnt;
      if (row.status === "sent" && row.email_type === "approval") stats.approval_sent += row.cnt;
    }
    return stats;
  } catch (_) {
    return { sent: 0, failed: 0, pending: 0, activation_sent: 0, approval_sent: 0 };
  }
}

/**
 * Send a decision notification email to an applicant
 */
export async function sendDecisionEmail({ to, applicantName, formName, decision, comment, orgName, template, templateVars, provider }) {
  const tv = { name: applicantName || "there", form_name: formName || "application", organization: orgName || "Future Studio", decision, comment: comment || "", ...(templateVars || {}) };
  const decisionLabel = decision === "approved" ? "approved" : decision === "rejected" ? "not selected to proceed" : "being reviewed";

  const subject = template?.subject
    ? applyTemplate(template.subject, tv)
    : decision === "approved"
      ? `Your ${formName || "application"} has been approved`
      : decision === "rejected"
        ? `Update on your ${formName || "application"}`
        : `Additional information needed — ${formName || "application"}`;

  const commentBlock = comment ? `<p style="margin:16px 0 0;font-size:14px;color:#cbd5e1;font-style:italic;border-left:3px solid #f97316;padding-left:12px;">"${comment}"</p>` : "";

  const bodyHtml = normalizeToHtml(
    template?.body
      ? applyTemplate(template.body, tv)
      : `<p style="margin:0 0 8px;font-size:15px;color:#e2e8f0;">Hello ${tv.name},</p><p style="margin:0 0 8px;font-size:14px;color:#94a3b8;line-height:1.6;">Your ${tv.form_name} has been <strong style="color:#f8fafc;">${decisionLabel}</strong>.</p>${commentBlock}`
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
              <h1 style="margin: 0 0 16px; font-size: 20px; font-weight: 800;">${subject}</h1>
              ${bodyHtml}
              ${FUTURE_STUDIO_FOOTER}
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body></html>`;

  return sendEmail({ to, subject, html, provider: provider || DECISION_EMAIL_DEFAULT });
}
