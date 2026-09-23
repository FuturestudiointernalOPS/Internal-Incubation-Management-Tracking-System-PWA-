/**
 * IMPACTOS MAILER
 *
 * Thin compatibility front over the platform email service.
 *
 * It used to be a standalone Resend-only sender that returned a *simulated*
 * success (`{ success: true, mock: true }`) when no Resend key was configured.
 * Callers therefore reported "sent" for an email that never left the system,
 * and a Resend failure left no visible trace.
 *
 * It now delegates to the shared transport, which:
 *   - picks the configured provider (Google Workspace first, Resend fallback),
 *   - automatically switches to the OTHER channel when one has no credentials,
 *   - refuses placeholder recipients,
 *   - and reports a REAL outcome (`success: false` when nothing was sent).
 *
 * The `{ to, subject, body, isHtml, fromName }` signature is preserved so
 * existing callers keep working unchanged.
 */

import { sendEmail as sendPlatformEmail } from "@/lib/email";

/** The shared transport sends HTML only; render a plain body faithfully. */
function plainTextToHtml(text) {
  const escaped = String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; white-space: pre-wrap;">${escaped}</div>`;
}

export async function sendEmail({ to, subject, body, isHtml, fromName }) {
  const html = isHtml ? String(body ?? "") : plainTextToHtml(body);
  return sendPlatformEmail({ to, subject, html, fromName });
}
