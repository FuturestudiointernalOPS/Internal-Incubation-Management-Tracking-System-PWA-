/**
 * STAGE NOTIFICATIONS — the studio's call to action.
 *
 * Two audiences, one delivery helper:
 *   • the Venture's **Venture Managers**;
 *   • every **Super Admin**.
 *
 * Each recipient gets an in-app notification AND an email, written in THEIR
 * language (`contacts.language`), not in a bilingual blob.
 *
 * Deduped PER RECIPIENT through the notification inbox's own dedupe key, which
 * is also what stops a weekly sweep from mailing the same flag every Monday.
 *
 * Delivery is best-effort by design: a mail failure must never roll back a
 * proposal, which is already committed.
 */

import { sendStandaloneEmail } from "@/lib/email";
import {
  selectSuperAdminContacts,
  selectLeadManagerContactIds,
  selectNotifyRecipient,
} from "@/models/ventureNotifyStore";
import { createVentureNotification } from "@/services/ventures/activity";

const STAGE_LABEL = {
  idea: { en: "Idea", fr: "Idée" },
  validation: { en: "Validation", fr: "Validation" },
  early_traction: { en: "Early Traction", fr: "Traction précoce" },
  growth: { en: "Growth", fr: "Croissance" },
  scaling: { en: "Scaling", fr: "Échelle" },
};

const stageName = (stage, lang) => (STAGE_LABEL[stage] || {})[lang] || stage;

/** The plain shell every venture notice already uses. */
function renderHtml(lines) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      ${lines
        .map(
          (line) =>
            `<p style="margin:8px 0;color:#334155;font-size:15px;line-height:1.5">${line}</p>`,
        )
        .join("")}
    </div>`;
}

/** Notification + email for ONE person, in their own language. */
async function deliver(recipient, { dbId, title, message, subject, lines, dedupeKey }) {
  const cid = recipient?.cid ? String(recipient.cid) : null;
  if (!cid) return 0;

  try {
    const notification = await createVentureNotification({
      recipient_id: cid,
      title,
      message,
      context: { venture_id: dbId },
      dedupeKey,
    });
    // Already told — no notification, no email.
    if (notification?.skipped) return 0;

    if (!recipient.email) return 0;
    const sent = await sendStandaloneEmail({
      to: recipient.email,
      subject,
      html: renderHtml(lines),
      contact_cid: cid,
      email_type: "venture_notification",
      provider: "gmail",
    });
    return sent && sent.success !== false ? 1 : 0;
  } catch (_) {
    return 0;
  }
}

/** The Venture's Venture Managers, each resolved with their language. */
async function resolveManagers(ventureCode) {
  const rows = (await selectLeadManagerContactIds(ventureCode))?.rows || [];
  const seen = new Set();
  const recipients = [];
  for (const row of rows) {
    const cid = row?.staff_contact_id ? String(row.staff_contact_id) : null;
    if (!cid || seen.has(cid)) continue;
    seen.add(cid);
    const contact = (await selectNotifyRecipient(cid))?.rows?.[0] || null;
    if (contact) recipients.push(contact);
  }
  return recipients;
}

async function resolveAdmins() {
  const rows = (await selectSuperAdminContacts())?.rows || [];
  return rows.filter((row) => row?.cid);
}

/**
 * A promotion has been PROPOSED. Sent once per proposal and recipient.
 */
export async function notifyStageProposal({ dbId, ventureCode, proposal }) {
  const dedupeKey = `stage-proposal:${proposal.id}`;
  const recipients = [
    ...(await resolveManagers(ventureCode)),
    ...(await resolveAdmins()),
  ];

  let notified = 0;
  for (const recipient of recipients) {
    const lang = recipient.language === "fr" ? "fr" : "en";
    const target = stageName(proposal.toStage, lang);
    const from = stageName(proposal.fromStage, lang);

    const subject =
      lang === "fr"
        ? `[Future Studio] ${ventureCode} — promotion vers ${target} à approuver`
        : `[Future Studio] ${ventureCode} — promotion to ${target} ready for approval`;
    const title = lang === "fr" ? `Promotion à approuver : ${target}` : `Stage promotion ready: ${target}`;
    const message =
      lang === "fr"
        ? `${ventureCode} remplit désormais tous les critères du stade ${target}. Ouvrez l'écran de reporting pour approuver ou refuser.`
        : `${ventureCode} now meets every criterion for ${target}. Review and approve it in the reporting screen.`;
    const lines =
      lang === "fr"
        ? [
            `<strong>${ventureCode}</strong> remplit désormais tous les critères du stade <strong>${target}</strong> (depuis ${from}).`,
            "Ouvrez l'écran de reporting de la Venture pour approuver ou refuser la promotion.",
          ]
        : [
            `<strong>${ventureCode}</strong> now meets every criterion for the <strong>${target}</strong> stage (from ${from}).`,
            "Open the Venture's reporting screen to approve or reject the promotion.",
          ];

    notified += await deliver(recipient, { dbId, title, message, subject, lines, dedupeKey });
  }

  return { notified, recipients: recipients.length };
}

/**
 * The REVIEW FLAG (spec §4.3): below the current stage's criteria for N
 * consecutive months. Deduped on the latest validated month, so a Monday sweep
 * cannot repeat it; a new validated month re-arms it.
 */
export async function notifyStageReview({ dbId, ventureCode, monthsBelow, latestPeriod }) {
  const dedupeKey = `stage-review:${ventureCode}:${latestPeriod || "unknown"}`;
  const recipients = [
    ...(await resolveManagers(ventureCode)),
    ...(await resolveAdmins()),
  ];

  let notified = 0;
  for (const recipient of recipients) {
    const lang = recipient.language === "fr" ? "fr" : "en";

    const subject =
      lang === "fr"
        ? `[Future Studio] ${ventureCode} — signal de revue de stade`
        : `[Future Studio] ${ventureCode} — stage review flag`;
    const title = lang === "fr" ? "Signal de revue de stade" : "Stage review flag";
    const message =
      lang === "fr"
        ? `${ventureCode} est sous les critères de son stade actuel depuis ${monthsBelow} mois consécutifs.`
        : `${ventureCode} has been below its current stage's criteria for ${monthsBelow} consecutive months.`;
    const lines =
      lang === "fr"
        ? [
            `<strong>${ventureCode}</strong> est sous les critères de son stade actuel depuis <strong>${monthsBelow} mois consécutifs</strong>.`,
            "Il s'agit d'un signal pour décision, pas d'une rétrogradation automatique. Ouvrez l'écran de reporting de la Venture pour décider de la suite.",
          ]
        : [
            `<strong>${ventureCode}</strong> has been below its current stage's criteria for <strong>${monthsBelow} consecutive months</strong>.`,
            "This is a flag for a decision, not an automatic demotion. Open the Venture's reporting screen to decide what happens next.",
          ];

    notified += await deliver(recipient, { dbId, title, message, subject, lines, dedupeKey });
  }

  return { notified, recipients: recipients.length };
}
