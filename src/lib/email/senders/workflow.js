/**
 * Form workflow emails: decision and confirmation
 *
 * Sent to an applicant once a submission is decided or confirmed.
 *
 * Cut out of src/lib/email.js as-is: the bodies below are byte-identical to
 * the monolith's. Nothing decides anything here that the monolith did not
 * already decide; the split only moves each concern next to its own code.
 */

import { normalizeToHtml } from "@/models/platform/ai/email-personalize";
import { DECISION_EMAIL_DEFAULT } from "../config";
import { sendEmail } from "../send";
import { FUTURE_STUDIO_FOOTER, applyTemplate } from "../templates";

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
