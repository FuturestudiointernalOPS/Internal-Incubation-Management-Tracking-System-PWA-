/**
 * Configuration read from the environment
 *
 * Every constant here comes from the process environment. They are read once, at
 *  * import time, exactly as the monolith read them: a missing credential must
 *  * stay a missing credential at call time, not a throw at boot.
 *
 * Cut out of src/lib/email.js as-is: the bodies below are byte-identical to
 * the monolith's. Nothing decides anything here that the monolith did not
 * already decide; the split only moves each concern next to its own code.
 */

import { resolveAppUrl } from "@/lib/appUrl";

export const RESEND_API_KEY = process.env.RESEND_API_KEY;

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@impactos.futurestudio.bj";

const rawAppUrl = resolveAppUrl();

export const APP_URL = (typeof rawAppUrl === "string" ? rawAppUrl : "http://localhost:3000").replace(/\/login.*$/i, "").replace(/\/$/, "");

export const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;

export const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;

export const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;

export const GMAIL_REDIRECT_URI = process.env.GMAIL_REDIRECT_URI;

export const GMAIL_SENDER_EMAIL = process.env.GMAIL_SENDER_EMAIL || "info@futurestudio.bj";

export const GMAIL_SENDER_NAME = "Future Studio";

// Decision emails default to Gmail when credentials exist; override with
// DECISION_EMAIL_PROVIDER=resend if needed. Activation stays on Resend.
export const DECISION_EMAIL_DEFAULT =
  process.env.DECISION_EMAIL_PROVIDER ||
  (GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REFRESH_TOKEN ? "gmail" : "resend");

// Gmail is the primary provider for ALL transactional email types whenever
// the existing Gmail (Google Workspace) credentials are configured — the
// same credentials already used for decision/approval emails. Resend remains
// the automatic fallback inside sendEmail(). Environments without Gmail
// credentials degrade to Resend automatically (never a broken default).
// Set EMAIL_PRIMARY_PROVIDER=resend to force Resend-first globally.
export const EMAIL_PRIMARY_DEFAULT =
  process.env.EMAIL_PRIMARY_PROVIDER === "resend"
    ? "resend"
    : GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REFRESH_TOKEN
      ? "gmail"
      : "resend";

export function gmailCredentialsAvailable() {
  return !!(GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REFRESH_TOKEN);
}

/**
 * What the mail configuration IS — for diagnosing a send from the running
 * environment (production included) without ever revealing a secret.
 *
 * Only presence is reported: which credential NAMES are missing, which provider
 * is primary and why, and the sender addresses (already visible on every mail
 * we send). No key, token or secret is ever returned.
 */
export function describeEmailConfig() {
  const gmailMissing = [
    ["GMAIL_CLIENT_ID", GMAIL_CLIENT_ID],
    ["GMAIL_CLIENT_SECRET", GMAIL_CLIENT_SECRET],
    ["GMAIL_REFRESH_TOKEN", GMAIL_REFRESH_TOKEN],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  return {
    primaryProvider: EMAIL_PRIMARY_DEFAULT,
    // Set `EMAIL_PRIMARY_PROVIDER=resend` and Gmail stops being chosen first,
    // however complete its credentials are.
    forcedByEnv:
      process.env.EMAIL_PRIMARY_PROVIDER === "resend" ? "EMAIL_PRIMARY_PROVIDER=resend" : null,
    gmail: {
      configured: gmailCredentialsAvailable(),
      senderEmail: GMAIL_SENDER_EMAIL,
      missing: gmailMissing,
      redirectUri: GMAIL_REDIRECT_URI || null,
    },
    resend: {
      configured: Boolean(RESEND_API_KEY),
      fromEmail: FROM_EMAIL,
    },
    attachments: {
      // An .ics attachment only travels on the Gmail transport: the Resend
      // sender in this codebase has no attachment support.
      supportedBy: ["gmail"],
      note: "Resend has no attachment support — a fallback send drops the .ics",
    },
  };
}
