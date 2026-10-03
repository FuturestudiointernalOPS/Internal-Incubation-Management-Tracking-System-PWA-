/**
 * Choosing a provider
 *
 * Primary provider, then the fallback, then a precise error. This is the only
 *  * place that knows both transports exist.
 *
 * Cut out of src/lib/email.js as-is: the bodies below are byte-identical to
 * the monolith's. Nothing decides anything here that the monolith did not
 * already decide; the split only moves each concern next to its own code.
 */

import { logger } from "@/lib/logger";
import { isPlaceholderEmail } from "./addresses";
import { EMAIL_PRIMARY_DEFAULT } from "./config";
import { sendViaGmail } from "./gmail";
import { sendViaResend } from "./resend";

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

  // EXTERNAL BOUNDARY. The recipient address is deliberately NOT logged (it is
  // personal data and the caller already knows who they emailed); the event,
  // the provider attempted and the duration are what an outage is diagnosed
  // with. A `requestId` is attached automatically when a request is in flight.
  const started = Date.now();

  const primary = await sendWith(chosen);
  if (primary.success) {
    logger.info("email_sent", {
      provider: primary.provider,
      durationMs: Date.now() - started,
    });
    return primary;
  }

  // One safe hand-off in the opposite direction so the recipient is still
  // reached when the primary transport fails or has no credentials.
  const secondary = await sendWith(fallback);
  if (secondary.success) {
    logger.warn("email_sent_via_fallback", {
      primary: chosen,
      provider: secondary.provider,
      durationMs: Date.now() - started,
    });
    return { ...secondary, provider: secondary.provider, fallback_used: true };
  }

  logger.error("email_send_failed", {
    provider: chosen,
    fallback,
    durationMs: Date.now() - started,
    error: primary.error || secondary.error || "Email send failed",
  });
  return {
    success: false,
    provider: chosen,
    error: primary.error || secondary.error || "Email send failed",
    note: "Primary provider (" + chosen + ") and fallback (" + fallback + ") both failed",
  };
}
