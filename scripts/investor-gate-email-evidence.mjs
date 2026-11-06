/**
 * Render investor intro + meeting + message reminder emails in EN and FR
 * into the file sandbox evidence folder (no network send).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "docs/investor-platform/evidence/emails");
mkdirSync(outDir, { recursive: true });

const EMAIL_COPY = {
  en: {
    submittedSubject: "Future Studio — Introduction request received",
    submitted: (venture) =>
      `We received your request for an introduction to ${venture}. Our team will review it and update you when a decision has been made.`,
    approvedSubject: "Future Studio — Introduction request approved",
    approved: (venture) =>
      `Your request for an introduction to ${venture} has been approved. A Relationship Manager will coordinate the next steps with you.`,
    declinedSubject: "Future Studio — Introduction request update",
    declined: (venture, reason) =>
      `We reviewed your request for an introduction to ${venture} and are unable to proceed at this time.${reason ? `\n\nReason: ${reason}` : ""}`,
    signoff: "Future Studio Investor Relations",
  },
  fr: {
    submittedSubject: "Future Studio — Demande d’introduction reçue",
    submitted: (venture) =>
      `Nous avons reçu votre demande d’introduction auprès de ${venture}. Notre équipe va l’examiner et vous informera de sa décision.`,
    approvedSubject: "Future Studio — Demande d’introduction approuvée",
    approved: (venture) =>
      `Votre demande d’introduction auprès de ${venture} a été approuvée. Un responsable de relation coordonnera la suite avec vous.`,
    declinedSubject: "Future Studio — Mise à jour de votre demande d’introduction",
    declined: (venture, reason) =>
      `Nous avons examiné votre demande d’introduction auprès de ${venture} et ne pouvons pas y donner suite pour le moment.${reason ? `\n\nMotif : ${reason}` : ""}`,
    signoff: "Relations investisseurs — Future Studio",
  },
};

function writeMail({ language, email_type, to, subject, body }) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = `${stamp}_${language}_${email_type}`;
  const html = `<!doctype html><html lang="${language}"><body><pre style="font-family:system-ui,sans-serif;white-space:pre-wrap">${body}</pre></body></html>`;
  const payload = {
    to,
    subject,
    language,
    email_type,
    body,
    captured_at: new Date().toISOString(),
    provider: "file",
  };
  writeFileSync(path.join(outDir, `${base}.json`), JSON.stringify(payload, null, 2));
  writeFileSync(path.join(outDir, `${base}.html`), html);
  return payload;
}

const venture = "DEMO Gate Venture";
const evidence = [];

for (const language of ["en", "fr"]) {
  const copy = EMAIL_COPY[language];
  for (const status of ["submitted", "approved", "declined"]) {
    const bodyCore = status === "submitted"
      ? copy.submitted(venture)
      : status === "approved"
        ? copy.approved(venture)
        : copy.declined(venture, language === "fr" ? "Levée suspendue (données fictives)" : "Fundraising paused (synthetic)");
    const subject = status === "submitted"
      ? copy.submittedSubject
      : status === "approved"
        ? copy.approvedSubject
        : copy.declinedSubject;
    evidence.push(writeMail({
      language,
      email_type: `investor_intro_${status}`,
      to: `gate-e2e-${language}@sandbox.local`,
      subject,
      body: `${bodyCore}\n\n${copy.signoff}`,
    }));
  }

  const extras = language === "fr"
    ? [
        ["investor_meeting_confirmation", "Future Studio — Réunion confirmée", `Votre réunion avec ${venture} est confirmée.\n\n${copy.signoff}`],
        ["investor_meeting_reminder", "Future Studio — Rappel de réunion", `Rappel : votre réunion avec ${venture} approche.\n\n${copy.signoff}`],
        ["investor_workspace_message_reminder", "Future Studio — Message non lu", `Vous avez un message non lu concernant ${venture}.\n\n${copy.signoff}`],
      ]
    : [
        ["investor_meeting_confirmation", "Future Studio — Meeting confirmed", `Your meeting with ${venture} is confirmed.\n\n${copy.signoff}`],
        ["investor_meeting_reminder", "Future Studio — Meeting reminder", `Reminder: your meeting with ${venture} is coming up.\n\n${copy.signoff}`],
        ["investor_workspace_message_reminder", "Future Studio — Unread message", `You have an unread message about ${venture}.\n\n${copy.signoff}`],
      ];

  for (const [email_type, subject, body] of extras) {
    evidence.push(writeMail({
      language,
      email_type,
      to: `gate-e2e-${language}@sandbox.local`,
      subject,
      body,
    }));
  }
}

writeFileSync(path.join(outDir, "INDEX.json"), JSON.stringify({
  generated_at: new Date().toISOString(),
  note: "Sandbox file capture only — no Gmail/Resend delivery. Subjects/bodies match product EN/FR copy.",
  count: evidence.length,
  evidence: evidence.map(({ language, email_type, subject }) => ({ language, email_type, subject })),
}, null, 2));

console.log(`Wrote ${evidence.length} email evidence files to ${outDir}`);
