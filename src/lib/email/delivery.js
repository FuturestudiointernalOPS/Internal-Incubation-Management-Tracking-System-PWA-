/**
 * Delivery, and the log it writes
 *
 * Standalone sends, tracked sends and manual messages: send through the provider
 *  * chooser, then record the attempt through @/services/email/log.
 *
 * Cut out of src/lib/email.js as-is: the bodies below are byte-identical to
 * the monolith's. Nothing decides anything here that the monolith did not
 * already decide; the split only moves each concern next to its own code.
 */

import { normalizeToHtml } from "@/models/platform/ai/email-personalize";
import { getEmailLogRow, recordEmailResult, recordStandaloneSend } from "@/services/email/log";
import { sendEmail } from "./send";
import { applyTemplate } from "./templates";

/** HTML-escape plain text so a body sent without markup cannot inject tags. */
function textToHtml(text) {
  const escaped = String(text || "").replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[character]));
  return `<pre style="font-family:inherit;white-space:pre-wrap;word-break:break-word;margin:0;">${escaped}</pre>`;
}

/** Send + record one standalone email. Used by the in-module senders below. */
export async function sendAndRecord({ to, subject, html, fromName, provider, contact_cid, email_type, note, attachments }) {
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
