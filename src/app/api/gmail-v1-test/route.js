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

/** Map provider errors to safe, non-sensitive categories for the response. */
function classifyError(err) {
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
      const tokenRes = await auth.getAccessToken();
      accessToken = tokenRes.token;
      report.authentication = "SUCCESS";
    } catch (e) {
      console.error("[gmail-v1-test] Token refresh failed:", classifyError(e));
      report.authentication = "FAILED";
      report.error = classifyError(e);
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
    } catch (e) {
      console.error("[gmail-v1-test] Profile read failed:", classifyError(e));
      report.authenticated_sender = null;
    }

    // Step 3 — send exactly ONE test email
    try {
      const gmail = google.gmail({ version: "v1", auth });
      const message = [
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

      const sendRes = await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: encoded },
      });

      report.gmail_api = "AVAILABLE";
      report.test_email = "SENT";
      report.message_id = sendRes.data.id || null;
      return NextResponse.json({ success: true, report });
    } catch (e) {
      console.error("[gmail-v1-test] Send failed:", classifyError(e));
      report.gmail_api = "FAILED";
      report.test_email = "FAILED";
      report.error = classifyError(e);
      return NextResponse.json({ success: false, report });
    }
  } catch (error) {
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
