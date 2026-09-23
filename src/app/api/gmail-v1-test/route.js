import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { google } from "googleapis";

/**
 * TEMPORARY DIAGNOSTIC — Gmail V1 Integration Test
 *
 * GET /api/gmail-v1-test   (super_admin only)
 *
 * Uses the EXISTING GMAIL_* environment variables (Vercel Production) to
 * test whether the legacy Gmail API integration is still functional.
 *
 * Sends exactly ONE email to a fixed recipient.
 *
 * SECURITY:
 *  - Never returns or logs secret values (client secret / refresh token)
 *  - Never echoes raw provider error messages in the response — only
 *    safe error categories (raw details go to server logs only)
 *  - Super-admin only
 *
 * ⚠️ DELETE THIS ROUTE after the diagnostic is complete.
 */

export const dynamic = "force-dynamic";

const TEST_RECIPIENT = "gclud79@gmail.com";
const TEST_SUBJECT = "Future Studio — Gmail API Test";
const TEST_BODY = `Hello,

This is a test email from the Future Studio platform using our existing Gmail API configuration.

We are testing whether the previous Gmail sending infrastructure is still active and usable.

Future Studio`;

// ─── SENDER IDENTITY (approved configuration) ──────────────────────────
// All Gmail-transport emails must come from the official Workspace mailbox.
// Recipient stays dynamic (per-email); only From/Reply-To are fixed.
const SENDER_EMAIL = process.env.GMAIL_SENDER_EMAIL || "info@futurestudio.bj";
const SENDER_NAME = "Future Studio";

/** Map provider errors to safe, non-sensitive categories for the response. */
function classifyError(error) {
  const message = String(error?.message || error?.response?.data?.error || "").toLowerCase();
  if (message.includes("invalid_grant")) return "refresh_token_invalid_or_revoked";
  if (message.includes("invalid_client")) return "client_id_or_secret_invalid";
  if (message.includes("access_denied") || message.includes("insufficient") || message.includes("forbidden"))
    return "permission_or_scope_denied";
  if (message.includes("quota") || message.includes("rate")) return "quota_or_rate_limit";
  if (message.includes("daily limit")) return "daily_send_limit_reached";
  if (message.includes("delegation") || message.includes("send-as")) return "sender_identity_not_authorized";
  if (message.includes("enabled") || message.includes("not found") || message.includes("404")) return "gmail_api_not_enabled";
  return "unknown_error";
}

export async function GET() {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
    const redirectUri = process.env.GMAIL_REDIRECT_URI;

    const report = {
      existing_gmail_api: "FOUND",
      credentials_available: !!(clientId && clientSecret && refreshToken),
      authentication: null,
      gmail_api: null,
      authenticated_sender: null,
      test_email: null,
      error: null,
    };

    if (!report.credentials_available) {
      report.error = "credentials_missing";
      return NextResponse.json({ success: false, report });
    }

    const auth = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri || "https://developers.google.com/oauthplayground"
    );
    auth.setCredentials({ refresh_token: refreshToken });

    // Step 1 — authenticate (refresh token validity)
    let accessToken;
    try {
      const tokenResult = await auth.getAccessToken();
      accessToken = tokenResult.token;
      report.authentication = "SUCCESS";
    } catch (error) {
      console.error("[gmail-v1-test] Token refresh failed:", classifyError(error));
      report.authentication = "FAILED";
      report.error = classifyError(error);
      return NextResponse.json({ success: false, report });
    }

    if (!accessToken) {
      report.authentication = "FAILED";
      report.error = "empty_access_token";
      return NextResponse.json({ success: false, report });
    }

    // Step 2 — identify the authenticated sender (email only, not a secret)
    try {
      const gmailProfile = google.gmail({ version: "v1", auth });
      const profile = await gmailProfile.users.getProfile({ userId: "me" });
      report.authenticated_sender = profile.data.emailAddress || null;
    } catch (error) {
      console.error("[gmail-v1-test] Profile read failed:", classifyError(error));
      report.authenticated_sender = null;
    }

    // Step 3 — send exactly ONE test email (From + Reply-To = info@futurestudio.bj)
    try {
      const gmail = google.gmail({ version: "v1", auth });
      const message = [
        `From: ${SENDER_NAME} <${SENDER_EMAIL}>`,
        `Reply-To: ${SENDER_EMAIL}`,
        `To: ${TEST_RECIPIENT}`,
        `Subject: ${TEST_SUBJECT}`,
        "Content-Type: text/plain; charset=utf-8",
        "",
        TEST_BODY,
      ].join("\n");

      const encoded = Buffer.from(message)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const sendResult = await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: encoded },
      });

      report.gmail_api = "AVAILABLE";
      report.test_email = "SENT";
      report.message_id = sendResult.data.id || null;
      report.from = `${SENDER_NAME} <${SENDER_EMAIL}>`;
      report.reply_to = SENDER_EMAIL;
      report.to = TEST_RECIPIENT;
      return NextResponse.json({ success: true, report });
    } catch (error) {
      console.error("[gmail-v1-test] Send failed:", classifyError(error));
      report.gmail_api = "FAILED";
      report.test_email = "FAILED";
      report.error = classifyError(error);
      return NextResponse.json({ success: false, report });
    }
  } catch {
    console.error("[gmail-v1-test] Unexpected error");
    return NextResponse.json(
      {
        success: false,
        report: {
          existing_gmail_api: "FOUND",
          credentials_available: null,
          authentication: null,
          gmail_api: null,
          authenticated_sender: null,
          test_email: null,
          error: "unexpected_error",
        },
      },
      { status: 500 }
    );
  }
}
