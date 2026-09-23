/**
 * IMPACTOS EMAIL SERVICE
 *
 * Uses Resend for transactional emails (invites, activation, password reset).
 * Replace with your own sender domain/email in RESEND_FROM_EMAIL.
 */

import { normalizeToHtml } from "@/lib/platform/ai/email-personalize";
import { resolveAppUrl } from "@/lib/appUrl";
import { TEMPLATE_VARIABLE_PATTERN } from "@/lib/constants";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@impactos.futurestudio.bj";
const rawAppUrl = resolveAppUrl();
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

// Gmail is the primary provider for ALL transactional email types whenever
// the existing Gmail (Google Workspace) credentials are configured — the
// same credentials already used for decision/approval emails. Resend remains
// the automatic fallback inside sendEmail(). Environments without Gmail
// credentials degrade to Resend automatically (never a broken default).
// Set EMAIL_PRIMARY_PROVIDER=resend to force Resend-first globally.
const EMAIL_PRIMARY_DEFAULT =
  process.env.EMAIL_PRIMARY_PROVIDER === "resend"
    ? "resend"
    : GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REFRESH_TOKEN
      ? "gmail"
      : "resend";

function gmailCredentialsAvailable() {
  return !!(GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REFRESH_TOKEN);
}

/** Map provider errors to safe, non-sensitive categories (never echo raw details). */
function classifyGmailError(err) {
  const errorText = String(err?.message || err?.response?.data?.error || "").toLowerCase();
  if (errorText.includes("invalid_grant")) return "refresh_token_invalid_or_revoked";
  if (errorText.includes("invalid_client")) return "client_id_or_secret_invalid";
  if (errorText.includes("access_denied") || errorText.includes("insufficient") || errorText.includes("forbidden"))
    return "permission_or_scope_denied";
  if (errorText.includes("quota") || errorText.includes("rate")) return "quota_or_rate_limit";
  if (errorText.includes("daily limit")) return "daily_send_limit_reached";
  if (errorText.includes("delegation") || errorText.includes("send-as")) return "sender_identity_not_authorized";
  if (errorText.includes("enabled") || errorText.includes("not found") || errorText.includes("404")) return "gmail_api_not_enabled";
  return "unknown_error";
}

/** RFC 2047 encode headers containing non-ASCII characters (e.g. French subjects). */
function encodeMailHeader(value) {
  if (!value) return "";
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

/** Build a raw MIME message for the Gmail API. Supports optional file
 * attachments (multipart/mixed) — used for PDF result documents. */
function buildGmailRawMessage({ to, subject, html, attachments, fromName }) {
  const plainText = (html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 4000);
  const altBoundary = `futurestudio_alt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const outerHeaders = [
    `From: ${fromName || GMAIL_SENDER_NAME} <${GMAIL_SENDER_EMAIL}>`,
    `Reply-To: ${GMAIL_SENDER_EMAIL}`,
    `To: ${to}`,
    `Subject: ${encodeMailHeader(subject)}`,
    "MIME-Version: 1.0",
  ].join("\n");

  // HTML + plain-text alternative body (its MIME headers are added where the
  // part is embedded — top-level for plain emails, inside multipart/mixed
  // when attachments are present).
  const altBody = [
    `--${altBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(plainText, "utf8").toString("base64"),
    `--${altBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(html || plainText, "utf8").toString("base64"),
    `--${altBoundary}--`,
  ].join("\n");
  const altHeader = `Content-Type: multipart/alternative; boundary="${altBoundary}"`;

  const list = Array.isArray(attachments) ? attachments.filter((attachment) => attachment && attachment.content != null) : [];
  if (list.length === 0) {
    return Buffer.from([outerHeaders, altHeader, "", altBody].join("\n"), "utf8").toString("base64url");
  }

  // With attachments the message becomes multipart/mixed: the HTML/plain
  // alternative part first, then one base64 part per attachment.
  const mixedBoundary = `futurestudio_mix_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const mixedParts = [`--${mixedBoundary}`, altHeader, "", altBody];
  for (const att of list) {
    // RFC 2047 cannot be used inside Content-Disposition filename; keep names
    // ASCII-safe (callers build them from slugified identifiers).
    const name = String(att.filename || "attachment").replace(/[^\x20-\x7E]/g, "_");
    mixedParts.push(
      `--${mixedBoundary}`,
      `Content-Type: ${att.contentType || "application/octet-stream"}; name="${name}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${name}"`,
      "",
      Buffer.from(att.content).toString("base64")
    );
  }
  mixedParts.push(`--${mixedBoundary}--`);
  return Buffer.from([outerHeaders, `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`, "", ...mixedParts].join("\n"), "utf8").toString("base64url");
}

/** Send one email through the Google Workspace (Gmail API) transport. */
async function sendViaGmail({ to, subject, html, attachments, fromName }) {
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
    const raw = buildGmailRawMessage({ to, subject, html, attachments, fromName });
    const sendRes = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });

    return { success: true, provider: "gmail", data: { id: sendRes.data?.id || null } };
  } catch (error) {
    console.error("[Gmail] Send error:", classifyGmailError(error));
    return { success: false, provider: "gmail", error: classifyGmailError(error) };
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
 * Replace {{variables}} in a template string with provided values, then remove
 * whatever placeholder is left over.
 *
 * Only the names this caller actually passes can be filled in. Any OTHER name
 * has no value and must never reach a recipient as raw `{{text}}` — so the
 * final sweep deletes it. The template editors warn about those names as they
 * are typed (see findUnknownTemplateVariables), making this a safety net rather
 * than the only line of defence.
 */
export function applyTemplate(text, vars = {}) {
  if (!text) return "";
  let result = String(text);
  for (const [key, val] of Object.entries(vars)) {
    // A name this sender provides is filled in even when the template carries
    // extra spaces ({{ name }}), so a hand-typed placeholder is not a trap.
    result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g"), val != null ? String(val) : "");
  }
  return result.replace(TEMPLATE_VARIABLE_PATTERN, "");
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
  const text = (value) => (typeof value === "string" ? value.trim() : value);
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
function resolveGreetingName(name) {
  const cleanedName = typeof name === "string" ? name.replace(/\s+/g, " ").trim() : "";
  if (!cleanedName || cleanedName.includes("@")) return "";
  if (/^(unknown|anonymous|n\/a|none|participant|null|undefined|-+|\s*)$/i.test(cleanedName)) return "";
  return cleanedName;
}

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

/**
 * Send a venture approval email (venture created via invite link has been approved).
 * Includes a setup link so the founder can set their password and access the dashboard.
 */
export async function sendVentureApprovalEmail({ to, name, ventureName, setupUrl, contact_cid }) {
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

              <h2 style="color: #f8fafc; font-size: 18px; margin: 0 0 8px;">You have been approved to be a Venture at Future Studio! 🎉</h2>
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 8px;">
                Hi <strong style="color: #f8fafc;">${name}</strong>,
              </p>
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                Great news — you have been approved to be a Venture at Future Studio. Your venture
                <strong style="color: #ff6600;">${ventureName}</strong> is now active on Venture OS.
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

  return sendAndRecord({ to, subject: `Your venture ${ventureName} has been approved`, html, contact_cid, email_type: "venture_approval" });
}

/**
 * Send a Venture Run invitation email (Invite ≠ create — the recipient
 * completes the Venture Application form; only approval creates the Venture).
 */
export async function sendVentureInvitationEmail({ to, name, runUrl, runName, contact_cid }) {
  const ctaUrl = runUrl || `${APP_URL}/login`;
  const ctaLabel = runUrl ? "COMPLETE YOUR VENTURE APPLICATION" : "LOG IN";
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

              <h2 style="color: #f8fafc; font-size: 18px; margin: 0 0 8px;">You're invited to register a Venture 🚀</h2>
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 8px;">
                Hi ${name ? `<strong style="color: #f8fafc;">${name}</strong>` : "there"},
              </p>
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                You have been invited to register a Venture${runName ? ` through <strong style="color: #f8fafc;">${runName}</strong>` : ""}.
                Complete the application below to get started. Your application will be reviewed, and
                your Venture is created only after approval.
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

  return sendAndRecord({ to, subject: "You're invited to register a Venture", html, contact_cid, email_type: "venture_invitation" });
}

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
 * Internal: sends email via Resend
 */
async function sendViaResend({ to, subject, html, fromName }) {
  if (!RESEND_API_KEY) {
    console.warn("Resend not configured — skipping email to:", to, "subject:", subject);
    return { success: false, provider: "resend", note: "Resend API key not configured" };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(RESEND_API_KEY);

    const { data, error } = await resend.emails.send({
      from: fromName ? `${fromName} <${FROM_EMAIL}>` : FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, provider: "resend", error };
    }

    return { success: true, provider: "resend", data };
  } catch (error) {
    console.error("Email send error:", error);
    return { success: false, provider: "resend", error: error.message };
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
export async function sendEmail({ to, subject, html, provider, attachments, fromName }) {
  // HARD GUARD: an internal placeholder address (import-…@placeholder…,
  // .local, example.com…) must NEVER leave the system, no matter which
  // code path built the recipient. This is the final safety net before any
  // provider is called.
  if (isPlaceholderEmail(to)) {
    console.warn("[Email] REFUSING to send to placeholder address:", to);
    return { success: false, provider: "blocked", error: "Refused — placeholder address is not a real recipient" };
  }

  const chosen = provider || EMAIL_PRIMARY_DEFAULT;
  const fallback = chosen === "gmail" ? "resend" : "gmail";
  const sendWith = (providerName) =>
    providerName === "gmail"
      ? sendViaGmail({ to, subject, html, attachments, fromName })
      : sendViaResend({ to, subject, html, fromName }); // Resend transport has no attachment support

  const primary = await sendWith(chosen);
  if (primary.success) return primary;

  // One safe hand-off in the opposite direction so the recipient is still
  // reached when the primary transport fails or has no credentials.
  const secondary = await sendWith(fallback);
  if (secondary.success) {
    return { ...secondary, provider: secondary.provider, fallback_used: true };
  }

  return {
    success: false,
    provider: chosen,
    error: primary.error || secondary.error || "Email send failed",
    note: "Primary provider (" + chosen + ") and fallback (" + fallback + ") both failed",
  };
}

// ─── STANDALONE SENDERS (no submission behind the email) ─────────────
// Invitations, password setup, approvals, credentials, campaigns. They use the
// SAME transport and the SAME delivery log as the workflow emails, so "sent"
// means sent and a failure is visible instead of silently successful.

/** HTML-escape plain text so a body sent without markup cannot inject tags. */
function textToHtml(text) {
  const escaped = String(text || "").replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[character]));
  return `<pre style="font-family:inherit;white-space:pre-wrap;word-break:break-word;margin:0;">${escaped}</pre>`;
}

/**
 * Append ONE row per standalone attempt (sent OR failed) to the shared log.
 * Never deduped: every attempt is history and the LATEST row is the status.
 */
async function recordStandaloneSend({ result, to, contact_cid, email_type, note, provider }) {
  try {
    await ensureEmailLogTable();
    const { default: db } = await import("@/lib/db");
    const recipient = to ? String(to).trim().substring(0, 300) : null;
    if (result?.success) {
      await db.execute({
        sql: `INSERT INTO platform_email_log (submission_id, contact_cid, email_type, status, provider, error, recipient, email_id, sent_at)
              VALUES (NULL, ?, ?, 'sent', ?, ?, ?, ?, NOW())`,
        args: [contact_cid || null, email_type, result?.provider || provider || null, note || null, recipient, result?.data?.id || null],
      });
    } else {
      const reason = result?.provider === "blocked"
        ? "Refused — the address is a placeholder, not a real recipient"
        : String(typeof result?.error === "string" ? result.error : result?.error ? JSON.stringify(result.error) : "Send failed");
      await db.execute({
        sql: `INSERT INTO platform_email_log (submission_id, contact_cid, email_type, status, provider, error, recipient)
              VALUES (NULL, ?, ?, 'failed', ?, ?, ?)`,
        args: [contact_cid || null, email_type, result?.provider || provider || null, reason.substring(0, 500), recipient],
      });
    }
  } catch (error) {
    console.warn("[EmailLog] Could not record standalone send:", error.message);
  }
}

/** Send + record one standalone email. Used by the in-module senders below. */
async function sendAndRecord({ to, subject, html, fromName, provider, contact_cid, email_type, note, attachments }) {
  const result = await sendEmail({ to, subject, html, fromName, provider, attachments });
  await recordStandaloneSend({ result, to, contact_cid, email_type, note, provider });
  return result;
}

/**
 * Public entry point for a STANDALONE transactional email — anything that is
 * not tied to a form submission: invitations, password setup, account
 * approvals, team credentials, campaign sends.
 *
 * Same transport as every workflow email (professional mailbox first, fallback
 * to the transactional service, placeholder addresses refused, attachments
 * supported) and same delivery log, so it can be supervised and its failure
 * seen. The argument shape matches the historical standalone sender
 * ({ to, subject, body, isHtml, fromName }) — `body` may be plain text or, with
 * isHtml, markup — plus `contact_cid` and `email_type` for the log.
 *
 * Returns the transport result: { success, provider, error?, data? }.
 */
export async function sendStandaloneEmail({
  to,
  subject,
  body,
  html,
  isHtml = false,
  fromName,
  contact_cid,
  email_type = "notification",
  note,
  provider,
  attachments,
}) {
  const content = html != null ? html : isHtml ? (body || "") : textToHtml(body);
  return sendAndRecord({ to, subject, html: content, fromName, provider, contact_cid, email_type, note, attachments });
}

// Every workflow email is tracked in platform_email_log so the system
// never sends the same email type twice for the same submission, and
// failed sends are distinguishable from successful ones.

let emailLogTablePromise = null;

async function ensureEmailLogTable() {
  if (emailLogTablePromise) return emailLogTablePromise;
  emailLogTablePromise = (async () => {
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
      await db.execute(`ALTER TABLE platform_email_log ADD COLUMN IF NOT EXISTS email_id TEXT`);
      await db.execute(`ALTER TABLE platform_email_log ADD COLUMN IF NOT EXISTS batch_id TEXT`);
      await db.execute(`DROP INDEX IF EXISTS idx_email_log_once`);
      await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_email_log_once
        ON platform_email_log (submission_id, email_type, COALESCE(batch_id, ''))
        WHERE status = 'sent'`);
      return true;
    } catch (error) {
      console.warn("[EmailLog] Could not ensure table:", error.message);
      emailLogTablePromise = null; // allow retry on transient failure
      return false;
    }
  })();
  return emailLogTablePromise;
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
 * ACTIVATION HISTORY — the real email/invitation history for a submission,
 * plus the state of its most recent password-setup token. Used to distinguish
 * a FIRST activation send from a RESEND (never guessed from account status)
 * and to surface first/last sent timestamps + link validity in the UI.
 *
 * Returns {
 *   email_status,        // latest platform_email_log status (sent/failed/pending/skipped…) or null
 *   first_sent_at,       // first successful send timestamp (sent rows only)
 *   last_sent_at,        // most recent successful send timestamp
 *   email_count,         // total activation log rows for the submission
 *   token_valid,         // most recent token exists, unused and not expired
 *   token_expires_at,    // expiry of the most recent token (or null)
 *   token_used,          // used flag of the most recent token (or null)
 * }
 */
export async function getActivationHistory({ submission_id, contact_cid }) {
  const empty = {
    email_status: null,
    first_sent_at: null,
    last_sent_at: null,
    email_count: 0,
    token_valid: false,
    token_expires_at: null,
    token_used: null,
  };
  try {
    await ensureEmailLogTable();
    const { default: db } = await import("@/lib/db");
    let rows = [];
    if (submission_id) {
      const res = await db.execute({
        sql: `SELECT status, sent_at, created_at, recipient, error
              FROM platform_email_log
              WHERE submission_id = ? AND email_type = 'activation'
              ORDER BY id ASC`,
        args: [parseInt(submission_id)],
      });
      rows = res.rows;
    }
    const sentRows = rows.filter((row) => row.status === "sent");

    let tokenValid = false;
    let tokenExpiresAt = null;
    let tokenUsed = null;
    if (contact_cid) {
      try {
        await ensurePasswordSetupTokensSchema();
        const tokRes = await db.execute({
          sql: `SELECT used, expires_at FROM password_setup_tokens
                WHERE contact_cid = ? ORDER BY created_at DESC, id DESC LIMIT 1`,
          args: [String(contact_cid)],
        });
        const tok = tokRes.rows[0];
        if (tok) {
          tokenUsed = tok.used;
          tokenExpiresAt = tok.expires_at;
          tokenValid = Number(tok.used) === 0 && new Date(tok.expires_at) > new Date();
        }
      } catch (_) {}
    }

    return {
      email_status: rows.length ? rows[rows.length - 1].status : null,
      first_sent_at: sentRows.length ? sentRows[0].sent_at || sentRows[0].created_at : null,
      last_sent_at: sentRows.length ? sentRows[sentRows.length - 1].sent_at || sentRows[sentRows.length - 1].created_at : null,
      email_count: rows.length,
      token_valid: tokenValid,
      token_expires_at: tokenExpiresAt,
      token_used: tokenUsed,
    };
  } catch (_) {
    return empty;
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
let passwordSetupTokensSchemaPromise = null;

export async function ensurePasswordSetupTokensSchema() {
  if (passwordSetupTokensSchemaPromise) return passwordSetupTokensSchemaPromise;
  passwordSetupTokensSchemaPromise = (async () => {
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
      await db.execute(`ALTER TABLE password_setup_tokens ADD COLUMN IF NOT EXISTS token_hash TEXT`);
      await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_password_setup_tokens_token_hash ON password_setup_tokens(token_hash) WHERE token_hash IS NOT NULL`);
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
    } catch (error) {
      console.warn("[TokenSchema] Could not ensure password_setup_tokens schema:", error.message);
      passwordSetupTokensSchemaPromise = null; // allow retry on transient failure
      return false;
    }
  })();
  return passwordSetupTokensSchemaPromise;
}

/**
 * Artificial/placeholder addresses (import fallbacks, reserved domains) must
 * never be treated as real recipients.
 */
export function isPlaceholderEmail(email) {
  if (!email || typeof email !== "string") return true;
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail.includes("@")) return true;
  if (normalizedEmail.includes("placeholder")) return true;
  if (normalizedEmail.includes("@example.") || normalizedEmail.includes("@test.") || normalizedEmail.endsWith(".local") || normalizedEmail.endsWith(".invalid")) return true;
  if (normalizedEmail.startsWith("import-")) return true; // import-generated placeholder pattern
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
  const labelOf = (fieldKey) => {
    const raw =
      fieldLabels && fieldLabels[String(fieldKey)] != null
        ? String(fieldLabels[String(fieldKey)])
        : String(fieldKey);
    return raw.toLowerCase().trim();
  };
  const isReal = (candidate) =>
    typeof candidate === "string" && candidate.includes("@") && !isPlaceholderEmail(candidate);
  // English + French email question labels (Email, E-mail, Email Address,
  // Adresse e-mail, Courriel, Mel…). Never matches a bare "Adresse" field.
  const EMAIL_HINTS = /(e-?mail|courriel|mel|adresse\s*(e-?mail|mail))/i;

  const labeled = [];
  const anyReal = [];
  for (const [fieldKey, fieldValue] of Object.entries(data)) {
    const value = typeof fieldValue === "string" ? fieldValue.trim() : "";
    if (!isReal(value)) continue;
    if (EMAIL_HINTS.test(labelOf(fieldKey))) labeled.push(value);
    else anyReal.push(value);
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

const GENERIC_NAMES = /^(unknown|anonymous|n\/a|none|participant|null|undefined|-+|\s*)$/i;

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
  const clean = (value) =>
    typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

  const data = submissionData && typeof submissionData === "object" ? submissionData : {};
  const stringify = (value) => {
    if (typeof value !== "string") return "";
    try {
      if (value.startsWith("{") && value.includes('"code"')) return ""; // phone objects
    } catch (_) {}
    return value;
  };
  // Effective label for a data key: field id → real question label.
  const labelOf = (fieldKey) => {
    const raw =
      fieldLabels && fieldLabels[String(fieldKey)] != null
        ? String(fieldLabels[String(fieldKey)])
        : String(fieldKey);
    return raw.toLowerCase().trim();
  };

  const fullNames = [];
  const firstNames = [];
  const lastNames = [];
  let bareName = "";

  for (const [fieldKey, fieldValue] of Object.entries(data)) {
    const value = clean(stringify(fieldValue));
    if (!value) continue;
    const label = labelOf(fieldKey);
    if (!label) continue;
    if (FULL_NAME_HINTS.test(label)) fullNames.push(value);
    else if (FIRST_NAME_HINTS.test(label)) firstNames.push(value);
    else if (LAST_NAME_HINTS.test(label) || FR_LAST_NAME_HINTS.test(label)) lastNames.push(value);
    else if (NAME_HINTS.test(label)) bareName = bareName || value;
  }

  const candidates = [];

  // 1. CRM verified full name
  if (clean(contactName)) candidates.push(clean(contactName));

  // 2. Submission full-name field(s)
  for (const fullName of fullNames) candidates.push(fullName);

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
  for (const [fieldKey, fieldValue] of Object.entries(data)) {
    const key = labelOf(fieldKey);
    const value = clean(stringify(fieldValue));
    if (!value || !key) continue;
    if (key.includes("name") || key.includes("nom") || key.includes("prénom") || key.includes("prenom")) {
      candidates.push(value);
    }
  }

  for (const candidate of candidates) {
    if (candidate && !GENERIC_NAMES.test(candidate)) return candidate;
  }
  return "";
}

// Project / venture name fields. The Founder Fit Score asks for a "Startup
// Name"; other venture forms use Project / Nom du projet. Kept apart from the
// person-name hints on purpose — a company name is never the applicant's name.
const PROJECT_NAME_HINTS =
  /^(startup|project|company|venture|business)\s*(name)?$|^nom\s+(du\s+|de\s+la\s+|de\s+l['’]?)?(projet|startup|entreprise|soci[eé]t[eé])$|^(nom|name)\s+(du\s+|of\s+(the\s+)?)?(projet|project)$/i;

/**
 * Resolve the applicant's project / venture name from the submission, using the
 * form's real question labels (submission data is keyed by field id). Returns
 * "" when the form never asked for one — callers then fall back to neutral
 * wording instead of printing an empty gap.
 */
export function resolveProjectName({ submissionData, fieldLabels }) {
  const data = submissionData && typeof submissionData === "object" ? submissionData : {};
  const clean = (value) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");
  const labelOf = (fieldKey) =>
    fieldLabels && fieldLabels[String(fieldKey)] != null ? String(fieldLabels[String(fieldKey)]) : String(fieldKey);

  let loose = "";
  for (const [fieldKey, fieldValue] of Object.entries(data)) {
    const value = clean(fieldValue);
    if (!value) continue;
    const label = labelOf(fieldKey).trim();
    if (PROJECT_NAME_HINTS.test(label)) return value;
    // Softer net, never enough on its own: a label that merely mentions the
    // venture ("Startup Industry") must not match, hence the name/nom word.
    if (!loose && /(startup|projet|project|venture)/i.test(label) && /(name|nom)/i.test(label)) {
      loose = value;
    }
  }
  return loose;
}

/**
 * Infer the workflow language from form question labels. Returns "fr" when the
 * form's questions are predominantly French (Nom complet / Prénom / Courriel…),
 * otherwise "en". Used to set a new contact's language so the Welcome email
 * matches the form/workflow the applicant completed.
 */
export function detectLanguage(fieldLabels) {
  let fr = 0;
  let en = 0;
  for (const label of Object.values(fieldLabels || {})) {
    const labelText = String(label).toLowerCase();
    if (/nom complet|pr[eé]nom|prenom|courriel|t[eé]l[eé]phone|date de naissance|ville|pays/.test(labelText)) {
      fr++;
    } else if (/full name|first name|last name|email address|phone|date of birth|city|country/.test(labelText)) {
      en++;
    }
  }
  return fr > en ? "fr" : "en";
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
    const ALLOWED = ["pending", "skipped", "failed", "bounced", "cancelled"];
    const safeStatus = ALLOWED.includes(status) ? status : "failed";
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
  } catch (error) {
    console.warn("[EmailLog] Could not record status:", error.message);
  }
}

/** Record a hard failure (status 'failed') with a reason. */
export async function recordEmailFailure(args) {
  return recordEmailStatus({ ...args, status: "failed" });
}

/**
 * Mark the most recent SENT email to a recipient as BOUNCED (provider
 * reported the recipient could not receive it). Keeps the sent row and adds
 * a bounced row as the latest status — history is never deleted.
 */
export async function markEmailBounced({ recipient, error }) {
  try {
    await ensureEmailLogTable();
    const { default: db } = await import("@/lib/db");
    const res = await db.execute({
      sql: `SELECT * FROM platform_email_log
            WHERE LOWER(recipient) = LOWER(?) AND status = 'sent'
            ORDER BY id DESC LIMIT 1`,
      args: [String(recipient).trim()],
    });
    const row = res.rows[0];
    if (!row) return false;
    await db.execute({
      sql: `INSERT INTO platform_email_log (submission_id, contact_cid, email_type, status, provider, error, recipient, sent_at)
            VALUES (?, ?, ?, 'bounced', ?, ?, ?, ?)`,
      args: [
        row.submission_id,
        row.contact_cid || null,
        row.email_type,
        row.provider || null,
        (error || "Bounced — provider reported delivery failure").substring(0, 500),
        row.recipient,
        row.sent_at,
      ],
    });
    return true;
  } catch (error) {
    console.warn("[EmailLog] markEmailBounced:", error.message);
    return false;
  }
}

/**
 * Record a Resend lifecycle event (delivered / delayed / bounced / failed /
 * opened / clicked / complained). The event is APPENDED to the log so the
 * full timeline is preserved; the email is identified by Resend's email_id
 * (never just by recipient, so two emails to the same address stay distinct).
 * If the email_id is unknown (an email sent before email_id tracking was
 * added), no event is recorded and false is returned — legacy recipient-based
 * bounce handling remains in markEmailBounced for old records.
 */
export async function recordResendEvent({ email_id, status, error, createdAt }) {
  try {
    await ensureEmailLogTable();
    const { default: db } = await import("@/lib/db");
    let row = null;
    if (email_id) {
      const result = await db.execute({
        sql: "SELECT * FROM platform_email_log WHERE email_id = ? ORDER BY id DESC LIMIT 1",
        args: [String(email_id)],
      });
      row = result.rows[0] || null;
    }
    if (!row) return false; // unknown email_id — nothing to attach to
    const eventAt = createdAt ? new Date(createdAt).toISOString() : new Date().toISOString();
    await db.execute({
      sql: `INSERT INTO platform_email_log (submission_id, contact_cid, email_type, status, provider, error, recipient, email_id, sent_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        row.submission_id,
        row.contact_cid || null,
        row.email_type,
        status,
        row.provider || "resend",
        (error || "").substring(0, 500) || null,
        row.recipient,
        row.email_id || email_id || null,
        row.sent_at,
        eventAt,
      ],
    });
    return true;
  } catch (error) {
    console.warn("[EmailLog] recordResendEvent:", error.message);
    return false;
  }
}

async function recordEmailResult({ submission_id, contact_cid, email_type, success, error, provider, note, to, emailId, batch_id }) {
  try {
    await ensureEmailLogTable();
    const { default: db } = await import("@/lib/db");
    const recipient = to ? String(to).trim().substring(0, 300) : null;
    if (success) {
      await db.execute({
        sql: `INSERT INTO platform_email_log (submission_id, contact_cid, email_type, status, provider, error, recipient, email_id, batch_id, sent_at)
              VALUES (?, ?, ?, 'sent', ?, ?, ?, ?, ?, NOW())
              ON CONFLICT (submission_id, email_type, COALESCE(batch_id, '')) WHERE status = 'sent' DO NOTHING`,
        args: [submission_id ? parseInt(submission_id) : null, contact_cid || null, email_type, provider || null, note || null, recipient, emailId || null, batch_id || null],
      });
    } else {
      await db.execute({
        sql: `INSERT INTO platform_email_log (submission_id, contact_cid, email_type, status, provider, error, recipient, batch_id)
              VALUES (?, ?, ?, 'failed', ?, ?, ?, ?)`,
        args: [submission_id ? parseInt(submission_id) : null, contact_cid || null, email_type, provider || null, (error || "Unknown error").substring(0, 500), recipient, batch_id || null],
      });
    }
  } catch (error) {
    console.warn("[EmailLog] Could not record:", error.message);
  }
}

/**
 * Record a successful email send in the delivery log. Used by flows that send
 * directly without going through sendTrackedEmail (e.g. manual invites via
 * /api/auth/invite), so the Contacts activation-email badge and the Runs email
 * log agree on whether an activation email was actually sent.
 */
export async function recordEmailSent({ submission_id, contact_cid, email_type, provider, note, to, emailId, batch_id }) {
  try {
    await ensureEmailLogTable();
    const { default: db } = await import("@/lib/db");
    const recipient = to ? String(to).trim().substring(0, 300) : null;
    if (!submission_id && contact_cid) {
      // Manual invites are not submission-scoped; dedupe by contact + type so
      // resending does not create duplicate "sent" rows.
      const dup = await db.execute({
        sql: "SELECT 1 FROM platform_email_log WHERE contact_cid = ? AND email_type = ? AND submission_id IS NULL AND status = 'sent' LIMIT 1",
        args: [contact_cid, email_type],
      });
      if (dup.rows.length > 0) return false;
    }
    await db.execute({
      sql: `INSERT INTO platform_email_log (submission_id, contact_cid, email_type, status, provider, error, recipient, email_id, batch_id, sent_at)
            VALUES (?, ?, ?, 'sent', ?, ?, ?, ?, ?, NOW())
            ON CONFLICT (submission_id, email_type, COALESCE(batch_id, '')) WHERE status = 'sent' DO NOTHING`,
      args: [submission_id ? parseInt(submission_id) : null, contact_cid || null, email_type, provider || null, note || null, recipient, emailId || null, batch_id || null],
    });
    return true;
  } catch (error) {
    console.warn("[EmailLog] Could not record sent email:", error.message);
    return false;
  }
}

/**
 * Send a workflow email exactly once per (submission_id, email_type).
 * - Already sent → returns { skipped: true } without sending
 * - Send succeeds → records 'sent' and returns { success: true }
 * - Send fails → records 'failed' and returns { success: false } (retryable)
 */
export async function sendTrackedEmail({ submission_id, contact_cid, email_type, sendFn, provider, note, to, batch_id }) {
  const existing = await getEmailLogRow(submission_id, email_type);
  if (existing && existing.status === "sent" && !batch_id) {
    return { skipped: true, already_sent: true, log: existing };
  }

  let result;
  try {
    result = await sendFn();
  } catch (error) {
    result = { success: false, error: error?.message || "Send failed" };
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
    emailId: result?.data?.id || null,
    batch_id,
  });

  return { ...result, skipped: false };
}

/**
 * Send a manual, ad-hoc message from the Room Overview to a single
 * participant. Each manual message is tracked under email_type "manual" with
 * a unique batch_id so the same participant can receive multiple manual
 * messages without tripping the once-per-email-type dedup.
 */
export async function sendManualMessage({
  to,
  name,
  subject,
  body,
  submission_id,
  contact_cid,
  batch_id,
  templateVars = {},
}) {
  const tv = {
    name: name || "there",
    organization: "ImpactOS",
    ...templateVars,
  };
  const personalizedSubject = applyTemplate(subject || "", tv);
  const rawBody = applyTemplate(body || "", tv);
  const html = normalizeToHtml(rawBody);

  return sendTrackedEmail({
    submission_id,
    contact_cid,
    email_type: "manual",
    provider: "gmail",
    note: personalizedSubject || "Manual message",
    to,
    batch_id,
    sendFn: () =>
      sendEmail({
        to,
        subject: personalizedSubject,
        html,
        provider: "gmail",
      }),
  });
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

/**
 * Send the submission-confirmation (acknowledgement) email.
 *
 * Uses the SAME run → form → default template chain as the decision and
 * activation emails, the same branded shell, the same footer and the same
 * transport selection (professional mailbox first, Resend as the automatic
 * fallback) so the confirmation is no longer pinned to a single provider.
 */
export async function sendConfirmationEmail({ to, applicantName, formName, organization, template, templateVars }) {
  const tv = {
    name: applicantName || "there",
    form_name: formName || "application",
    organization: organization || "ImpactOS",
    ...(templateVars || {}),
  };

  const subject = template?.subject
    ? applyTemplate(template.subject, tv)
    : `Thank you for your submission — ${tv.form_name}`;

  const bodyHtml = normalizeToHtml(
    template?.body
      ? applyTemplate(template.body, tv)
      : `<p style="margin:0 0 8px;font-size:15px;color:#e2e8f0;">Hello ${tv.name},</p><p style="margin:0 0 8px;font-size:14px;color:#94a3b8;line-height:1.6;">We have received your submission for <strong style="color:#f8fafc;">${tv.form_name}</strong>.</p><p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.6;">Our team will review it and get back to you soon.</p>`
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

  return sendEmail({ to, subject, html });
}

// Shared inline styles for result-email paragraphs (dark card drawn by the shell).
const R_P = "color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 10px;";
const R_PL = "color:#94a3b8;font-size:14px;line-height:1.6;margin:0;";
const R_UL = "color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 10px;padding-left:20px;";

/**
 * Neutral result copy — every run EXCEPT the Founder Fit Score one. Deliberately
 * form-agnostic: it names neither the form, the run, nor what the report is.
 *
 * Both copies expose the same shape so the sender composes them identically:
 *   greetingHtml + openingHtml + accessHtml(hosted, url) + closingHtml
 */
function genericResultCopy({ isFr, greeting, frGreeting }) {
  return {
    subject: isFr ? "Résultat de votre soumission" : "Your submission result",
    greetingHtml: isFr ? `<p style="${R_P}">${frGreeting}</p>` : `<p style="${R_P}">${greeting}</p>`,
    openingHtml: "",
    // How the report is reached: attached, or a download button on the fallback
    // transport (which cannot carry the file).
    accessHtml: (hosted, url) => {
      if (!hosted) {
        return isFr
          ? `<p style="${R_PL}">Veuillez trouver ci-joint le résultat de votre soumission. Le document contient vos réponses, l'évaluation de votre soumission et votre score final. Merci pour votre participation.</p>`
          : `<p style="${R_PL}">Please find attached the result of your submission. The document contains your responses, the evaluation of your submission and your final score. Thank you for participating.</p>`;
      }
      return isFr
        ? `<p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 24px;">Le résultat de votre soumission est prêt. Le document contient vos réponses, l'évaluation de votre soumission et votre score final. Merci pour votre participation.</p>
       <table cellpadding="0" cellspacing="0" style="margin: 0 0 20px;"><tr><td align="center" style="background: #ff6600; border-radius: 12px; padding: 14px 32px;"><a href="${url}" style="color: #000; text-decoration: none; font-size: 14px; font-weight: 800; letter-spacing: 0.5px;">TÉLÉCHARGER MON RÉSULTAT (PDF)</a></td></tr></table>
       <p style="color:#64748b;font-size:12px;line-height:1.5;margin:0 0 4px;">Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :</p>
       <p style="color:#ff6600;font-size:11px;word-break:break-all;margin:0;">${url}</p>`
        : `<p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 24px;">The result of your submission is ready. The document contains your responses, the evaluation of your submission and your final score. Thank you for participating.</p>
       <table cellpadding="0" cellspacing="0" style="margin: 0 0 20px;"><tr><td align="center" style="background: #ff6600; border-radius: 12px; padding: 14px 32px;"><a href="${url}" style="color: #000; text-decoration: none; font-size: 14px; font-weight: 800; letter-spacing: 0.5px;">DOWNLOAD YOUR RESULT (PDF)</a></td></tr></table>
       <p style="color:#64748b;font-size:12px;line-height:1.5;margin:0 0 4px;">If the button doesn't work, copy and paste this link into your browser:</p>
       <p style="color:#ff6600;font-size:11px;word-break:break-all;margin:0;">${url}</p>`;
    },
    closingHtml: "",
  };
}

/**
 * Founder Fit Score result copy — used only by that run. Presents the report,
 * states the score out of 100, and closes on the recommendation.
 *
 * `scoreText` and `project` are optional: without a score the score sentence is
 * dropped, and without a project name the recommendation refers to "your
 * project" — so a form that never asked for a venture still reads correctly.
 */
function founderFitResultCopy({ isFr, greeting, frGreeting, scoreText, project }) {
  return {
    subject: isFr ? "Votre Founder Fit Score est disponible" : "Your Founder Fit Score is available",
    greetingHtml: isFr ? `<p style="${R_P}">${frGreeting}</p>` : `<p style="${R_P}">${greeting}</p>`,
    openingHtml: isFr
      ? `<p style="${R_P}">Merci d'avoir pris le temps de compléter le Founder Fit Score de Future Studio.</p>
       <p style="${R_P}">À partir de vos réponses, nous avons préparé un rapport personnalisé qui présente :</p>
       <ul style="${R_UL}">
         <li>votre score global ;</li>
         <li>votre résultat sur chacun des sept critères ;</li>
         <li>vos principaux points forts ;</li>
         <li>vos axes prioritaires de progression ;</li>
         <li>des recommandations concrètes pour faire évoluer votre projet.</li>
       </ul>
       ${scoreText ? `<p style="${R_P}">Votre Founder Fit Score est de <strong style="color:#f8fafc;">${scoreText} / 100</strong>.</p>` : ""}
       <p style="${R_P}">Ce résultat ne constitue ni un jugement définitif ni une étiquette. Il représente une photographie de votre profil actuel et vise à vous aider à mieux comprendre vos forces, les points à consolider et les prochaines décisions à prendre.</p>`
      : `<p style="${R_P}">Thank you for taking the time to complete Future Studio's Founder Fit Score.</p>
       <p style="${R_P}">Based on your answers, we have prepared a personalised report that presents:</p>
       <ul style="${R_UL}">
         <li>your overall score;</li>
         <li>your result on each of the seven criteria;</li>
         <li>your main strengths;</li>
         <li>your priority areas for progress;</li>
         <li>concrete recommendations to move your project forward.</li>
       </ul>
       ${scoreText ? `<p style="${R_P}">Your Founder Fit Score is <strong style="color:#f8fafc;">${scoreText} / 100</strong>.</p>` : ""}
       <p style="${R_P}">This result is neither a definitive judgment nor a label. It is a snapshot of your profile today, meant to help you better understand your strengths, what to consolidate and the next decisions to take.</p>`,
    accessHtml: (hosted, url) => {
      if (hosted) {
        return isFr
          ? `<p style="${R_P}">Vous pouvez consulter votre rapport complet en téléchargeant le document ci-dessous.</p>
       <table cellpadding="0" cellspacing="0" style="margin: 0 0 20px;"><tr><td align="center" style="background: #ff6600; border-radius: 12px; padding: 14px 32px;"><a href="${url}" style="color: #000; text-decoration: none; font-size: 14px; font-weight: 800; letter-spacing: 0.5px;">TÉLÉCHARGER MON RAPPORT (PDF)</a></td></tr></table>
       <p style="color:#64748b;font-size:12px;line-height:1.5;margin:0 0 10px;">Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur : <span style="color:#ff6600;word-break:break-all;">${url}</span></p>`
          : `<p style="${R_P}">You can read your full report by downloading the document below.</p>
       <table cellpadding="0" cellspacing="0" style="margin: 0 0 20px;"><tr><td align="center" style="background: #ff6600; border-radius: 12px; padding: 14px 32px;"><a href="${url}" style="color: #000; text-decoration: none; font-size: 14px; font-weight: 800; letter-spacing: 0.5px;">DOWNLOAD MY REPORT (PDF)</a></td></tr></table>
       <p style="color:#64748b;font-size:12px;line-height:1.5;margin:0 0 10px;">If the button doesn't work, copy and paste this link into your browser: <span style="color:#ff6600;word-break:break-all;">${url}</span></p>`;
      }
      return isFr
        ? `<p style="${R_P}">Vous pouvez consulter votre rapport complet à travers le fichier joint.</p>`
        : `<p style="${R_P}">You can read your full report in the attached file.</p>`;
    },
    closingHtml: isFr
      ? `<p style="${R_P}">Nous vous recommandons de prendre le temps de lire les actions proposées, notamment celles liées à la validation du marché, à la traction commerciale et à la différenciation de ${project || "votre projet"}.</p>
       <p style="${R_P}">Nous restons disponibles pour échanger avec vous sur les résultats et identifier l'accompagnement Future Studio le plus adapté à votre niveau d'avancement.</p>
       <p style="${R_PL}">Bien cordialement,<br>L'équipe Future Studio</p>`
      : `<p style="${R_P}">We recommend taking the time to read the proposed actions, especially those related to market validation, commercial traction and the differentiation of ${project || "your project"}.</p>
       <p style="${R_P}">We remain available to talk through the results with you and to identify the Future Studio support best suited to your stage of progress.</p>
       <p style="${R_PL}">Kind regards,<br>The Future Studio Team</p>`,
  };
}

/**
 * Send a participant-facing submission result email with a PDF document
 * (their responses, the evaluation and their final score).
 *
 * The copy comes from one of two sources, picked by `template`: the Founder Fit
 * Score message (`"founder_fit"`) or the neutral, form-agnostic one. Whoever the
 * recipient is, the message never mentions how the evaluation was produced.
 *
 * `score` and `projectName` are optional and only the Founder Fit copy uses
 * them: without a score its score sentence is dropped, and without a project
 * name its recommendation refers to "your project".
 *
 * Delivery:
 *  - Gmail transport attaches the PDF natively when Google Workspace
 *    credentials are configured.
 *  - Otherwise the PDF is hosted in Supabase storage and delivered as a
 *    download button through Resend (never silently dropped).
 */
export async function sendResultEmail({ to, applicantName, pdfBuffer, lang = "en", runId, submissionId, score, projectName, template }) {
  const isFr = (lang || "en").toLowerCase().startsWith("fr");
  const greetingName = resolveGreetingName(applicantName);
  const greeting = greetingName ? `Hello ${greetingName},` : "Hello,";
  const frGreeting = greetingName ? `Bonjour ${greetingName},` : "Bonjour,";
  const filename = "submission-result.pdf";
  const pdf = pdfBuffer ? Buffer.from(pdfBuffer) : null;

  // Optional inputs, both resolved by the caller from the submission: a form
  // that never asked for a venture produces an empty project, and an evaluation
  // without a score produces no score sentence at all.
  const project = typeof projectName === "string" ? projectName.replace(/\s+/g, " ").trim() : "";
  const scoreNum = Number(score);
  const scoreText = Number.isFinite(scoreNum) && String(score ?? "").trim() !== "" ? String(Math.round(scoreNum)) : "";

  // The Founder Fit Score run gets its own report-specific message; every other
  // run keeps the neutral, form-agnostic copy.
  const copy = template === "founder_fit"
    ? founderFitResultCopy({ isFr, greeting, frGreeting, scoreText, project })
    : genericResultCopy({ isFr, greeting, frGreeting });
  const subject = copy.subject;

  if (isPlaceholderEmail(to)) {
    console.warn("[Email] REFUSING to send to placeholder address:", to);
    return { success: false, provider: "blocked", error: "Refused — placeholder address is not a real recipient" };
  }
  if (!pdf) {
    return { success: false, provider: "email", error: "Result PDF is empty — nothing to send" };
  }

  const shell = (bodyHtml) => `
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

  // One body for both transports — the copy is identical, only the way the
  // report is reached differs (attached, or a download button on the fallback).
  const compose = (hosted, url = "") =>
    shell(copy.greetingHtml + copy.openingHtml + copy.accessHtml(hosted, url) + copy.closingHtml);

  // Preferred path: native PDF attachment through the Gmail API transport.
  if (gmailCredentialsAvailable()) {
    const res = await sendViaGmail({
      to,
      subject,
      html: compose(false),
      attachments: [{ filename, content: pdf, contentType: "application/pdf" }],
    });
    if (res.success) return res;
    // Gmail failed → fall through to the hosted-link delivery below instead of
    // failing: the participant still receives their result.
  }

  // Fallback path: host the PDF in Supabase storage (public bucket, same as
  // the platform's uploads) and email a download link through Resend.
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { success: false, provider: "storage", error: "No attachment-capable email transport configured: set GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET/GMAIL_REFRESH_TOKEN or NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY" };
    }
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const rand = Math.random().toString(36).slice(2, 10);
    const folder = runId ? `run-${runId}` : "general";
    const objectPath = `submission-results/${folder}/${submissionId ? `submission-${submissionId}-` : ""}${Date.now()}-${rand}.pdf`;
    const upload = () =>
      supabase.storage.from("submissions").upload(objectPath, pdf, {
        contentType: "application/pdf",
        cacheControl: "3600",
        upsert: true,
      });
    let res = await upload();
    if (res.error && /bucket.*not found|does not exist/i.test(res.error.message || "")) {
      await supabase.storage.createBucket("submissions", { public: true });
      res = await upload();
    }
    if (res.error) throw res.error;
    const url = supabase.storage.from("submissions").getPublicUrl(objectPath).data.publicUrl;
    const mailRes = await sendViaResend({ to, subject, html: compose(true, url) });
    if (!mailRes.success) {
      return { ...mailRes, error: mailRes.error || mailRes.note || "Email send failed" };
    }
    return mailRes;
  } catch (error) {
    console.error("[Email] Result delivery (hosted PDF) error:", error?.message || error);
    return { success: false, provider: "storage", error: `Could not store the result PDF for delivery — ${error?.message || "storage error"}` };
  }
}
