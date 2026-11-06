import { sendStandaloneEmail } from "@/lib/email";
import { getIntroductionNotificationContext } from "@/models/investor/introductions";

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

export async function sendIntroductionEmail({ investorProfileId, ventureId, status, declineReason = null }) {
  const context = (await getIntroductionNotificationContext(investorProfileId, ventureId)).rows?.[0];
  if (!context?.email) return { sent: false, reason: "recipient_unavailable" };
  const copy = EMAIL_COPY[context.language] || EMAIL_COPY.en;
  const content = status === "submitted"
    ? { subject: copy.submittedSubject, body: copy.submitted(context.venture_name) }
    : status === "approved"
      ? { subject: copy.approvedSubject, body: copy.approved(context.venture_name) }
      : { subject: copy.declinedSubject, body: copy.declined(context.venture_name, declineReason) };

  const result = await sendStandaloneEmail({
    to: context.email,
    contact_cid: context.cid,
    email_type: `investor_intro_${status}`,
    subject: content.subject,
    body: `${content.body}\n\n${copy.signoff}`,
  });
  return result?.success
    ? { sent: true }
    : { sent: false, reason: "delivery_failed" };
}
