import { google } from "googleapis";

/**
 * Shared Mailer Utility
 * Merges V1 Automation power into V2 Incubation logic.
 */

let auth, gmailClient;

function getGmailClient() {
  if (gmailClient) return gmailClient;

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const redirectUri = process.env.GMAIL_REDIRECT_URI || "https://developers.google.com/oauthplayground";
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !refreshToken) {
    console.warn("[MAILER] Gmail credentials missing. Emailing will be disabled (mock mode).");
    return null;
  }

  auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  auth.setCredentials({ refresh_token: refreshToken });
  gmailClient = google.gmail({ version: "v1", auth });
  return gmailClient;
}

/**
 * Sends a raw email via Gmail API
 */
export async function sendEmail({ to, subject, body, fromName = "ImpactOS Program Office", isHtml = false }) {
  const gmail = getGmailClient();
  
  const content = isHtml ? body : `
    <div style="font-family: sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #e2e8f0; border-radius: 16px;">
      <p style="font-size: 11px; letter-spacing: 0.2em; color: #6366f1; font-weight: 900; text-transform: uppercase; margin-bottom: 24px;">Secure Portal Notification</p>
      <div style="font-size: 16px; color: #334155; line-height: 1.8; white-space: pre-wrap;">${body}</div>
      
      <p style="margin-top: 50px; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 25px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: bold;">
        Sent via ${fromName} · Executive Incubation Core
      </p>
    </div>
  `;

  if (!gmail) {
    console.log(`[MOCK EMAIL] To: ${to} | Subject: ${subject}`);
    return { success: true, mock: true };
  }

  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/html; charset=utf-8",
    "",
    content
  ].join("\n");

  const encodedMessage = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  try {
    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodedMessage }
    });
    return { success: true };
  } catch (error) {
    console.error(`[MAILER ERROR] Failed to send email to ${to}:`, error);
    throw error;
  }
}
