/**
 * The Google Workspace (Gmail API) transport
 *
 * Native MIME, attachments, OAuth refresh. See config.js for the credentials.
 *
 * Cut out of src/lib/email.js as-is: the bodies below are byte-identical to
 * the monolith's. Nothing decides anything here that the monolith did not
 * already decide; the split only moves each concern next to its own code.
 */

import { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI, GMAIL_REFRESH_TOKEN, GMAIL_SENDER_EMAIL, GMAIL_SENDER_NAME, gmailCredentialsAvailable } from "./config";

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
export function buildGmailRawMessage({ to, cc, subject, html, attachments, fromName }) {
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
    ...(Array.isArray(cc) && cc.length > 0 ? [`Cc: ${cc.join(", ")}`] : []),
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
export async function sendViaGmail({ to, cc, subject, html, attachments, fromName }) {
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
    const raw = buildGmailRawMessage({ to, cc, subject, html, attachments, fromName });
    const sendRes = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });

    return { success: true, provider: "gmail", data: { id: sendRes.data?.id || null } };
  } catch (error) {
    console.error("[Gmail] Send error:", classifyGmailError(error));
    return { success: false, provider: "gmail", error: classifyGmailError(error) };
  }
}
