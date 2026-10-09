/**
 * Venture reminders
 *
 * The one email the reminder engine sends. Rides the SAME transport as every
 * other Venture email (Google Workspace first, Resend fallback) — the engine
 * chooses recipients and wording, never how mail leaves the platform.
 *
 * Returns the transport result unchanged: `success: false` means the email did
 * NOT leave the system, and the engine records the failure rather than calling
 * it sent.
 */

import { APP_URL } from "../config";
import { sendAndRecord } from "../delivery";
import { FUTURE_STUDIO_FOOTER } from "../templates";

/** Spreadsheet text is not trusted markup. */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** "23 Oct 2026" — a reminder is read at a glance, so the day is spelled out. */
function humanDate(iso) {
  if (!iso) return null;
  const parsed = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return String(iso);
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function labelRow(label, value, { bold = false } = {}) {
  if (!value) return "";
  return `<tr>
    <td style="padding: 4px 16px 4px 0; color: #64748b; font-size: 12px; white-space: nowrap; vertical-align: top;">${escapeHtml(label)}</td>
    <td style="padding: 4px 0; color: ${bold ? "#f8fafc" : "#cbd5e1"}; font-size: ${bold ? "15px" : "13px"}; font-weight: ${bold ? "700" : "400"};">${escapeHtml(value)}</td>
  </tr>`;
}

/**
 * One work-item reminder.
 *
 * @param {object} input
 * @param {string} input.to                — the single address this message is for
 * @param {object} input.item              — the work item, as `workItems` shapes it
 * @param {string} input.ventureName
 * @param {string} [input.ventureCode]     — for the deep link
 * @param {string} input.trigger           — "start" | "finish" | "manual"
 * @param {number} [input.daysLeft]        — days until the date the rule watched
 * @param {string} [input.watchedDate]     — the date the rule watched
 * @param {string} [input.sentBy]          — a person's name, for a manual send
 * @param {boolean} [input.hasAccount=true] — whether the recipient can sign in;
 *                                          false sends a signed-out click to
 *                                          registration instead of the login page
 * @param {string} [input.contact_cid]
 */
export async function sendVentureReminderEmail({
  to,
  item = {},
  ventureName,
  ventureCode,
  trigger = "manual",
  daysLeft = null,
  watchedDate = null,
  sentBy = null,
  hasAccount = true,
  contact_cid = null,
}) {
  const venue = ventureName || "your Venture";
  const title = item.title || "Untitled work";
  const date = humanDate(watchedDate || (trigger === "start" ? item.start : item.finish));

  // The subject says what happened and when it is due — the whole point of the
  // message has to survive a glance in a crowded inbox.
  const when = date
    ? daysLeft === null
      ? `due ${date}`
      : daysLeft <= 0
        ? `due ${date}`
        : `${trigger === "start" ? "starts" : "finishes"} ${date} — in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`
    : "needs your attention";
  const subjectPrefix = trigger === "start" ? "Starting soon" : trigger === "finish" ? "Due soon" : "Reminder";
  const subject = `${subjectPrefix}: ${item.ref ? `${item.ref} ` : ""}${title} — ${when}`;

  // The button goes through /open, which decides at CLICK time: a signed-in
  // reader lands on the Venture, a signed-out one on the login page — or on
  // registration when this address had no account when the email was sent.
  const openUrl = ventureCode
    ? `${APP_URL}/open/venture/${encodeURIComponent(ventureCode)}${hasAccount ? "" : "?signup=1"}`
    : null;

  const context = [item.journey?.name, item.milestone?.title].filter(Boolean).join("  ›  ");
  const manualLine = sentBy
    ? `<p style="color: #64748b; font-size: 12px; margin: 0 0 20px;">${escapeHtml(sentBy)} sent you this reminder.</p>`
    : "";

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #020617; color: #f8fafc; margin: 0; padding: 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background: #020617;">
        <tr><td align="center" style="padding: 40px 20px;">
          <table width="520" cellpadding="0" cellspacing="0" style="background: #0f172a; border-radius: 16px; border: 1px solid #334155;">
            <tr><td style="padding: 32px 32px 28px;">
              <h1 style="margin: 0 0 4px; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">
                <span style="color: #ff6600;">Impact</span><span style="color: #f8fafc;">OS</span>
              </h1>
              <p style="color: #64748b; font-size: 12px; margin: 0 0 24px;">${escapeHtml(venue)}</p>

              <h2 style="color: #f8fafc; font-size: 17px; margin: 0 0 6px;">${escapeHtml(title)}</h2>
              <p style="color: #94a3b8; font-size: 13px; margin: 0 0 20px;">${escapeHtml(when)}${context ? ` · ${escapeHtml(context)}` : ""}</p>
              ${manualLine}

              <table cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
                ${labelRow("Code", item.ref, { bold: true })}
                ${labelRow("Activity", item.activity || title)}
                ${labelRow("Deliverable", item.deliverable)}
                ${labelRow("Definition of Done", item.definition_of_done)}
                ${labelRow("Status", item.status?.raw || item.status?.id || null)}
                ${labelRow("Owner", item.owner?.name)}
                ${labelRow("Supporting", item.supporting)}
                ${labelRow("Start", humanDate(item.start))}
                ${labelRow("Finish", humanDate(item.finish))}
              </table>

              ${
                openUrl
                  ? `<a href="${openUrl}" style="display: inline-block; background: #ff6600; color: #020617; text-decoration: none; font-weight: 700; font-size: 13px; padding: 12px 20px; border-radius: 10px;">Open in ImpactOS</a>
                     ${hasAccount ? "" : `<p style="color: #64748b; font-size: 12px; margin: 12px 0 0;">You do not have an ImpactOS account yet — the button takes you to registration.</p>`}`
                  : ""
              }
            </td></tr>
            <tr><td style="padding: 0 32px 28px;">${FUTURE_STUDIO_FOOTER}</td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>`;

  return sendAndRecord({
    to,
    subject,
    html,
    contact_cid,
    // The transport's own record of the send, separate from the reminder log —
    // one answers "did the mail leave", the other "was the work chased".
    email_type: "venture_reminder",
    note: `${trigger}:${item.id || ""}`,
  });
}
