import {
  audit,
  notifyUser,
} from "@/models/platform/integrations";
import { resolveDefaultRole } from "@/models/platform/roles";
import { resolveAutomationFlag } from "@/lib/platform/automationSettings";
import { stopRoleMutationEnabled } from "@/lib/identity";
import {
  resolveSubmissionEmail,
  resolvePersonName,
  getTemplate,
  sendTrackedEmail,
  sendConfirmationEmail,
} from "@/lib/email";
import {
  getDecisionEmailSubmissionById,
  getFieldLabelsByRunId,
  getContactNameEmailByCid,
  getRunTemplateSettingsForDecisionById,
} from "@/models/formRuns";
import { hashToken } from "@/lib/token-hashing";
import { syncCrmContact, writeCrmTimeline } from "./crmHelpers";

// ─── SUBMISSION CONFIRMATION (acknowledgement) ─────────────────────

/**
 * Send (or re-send) the tracked submission-confirmation email for a submission.
 *
 * Uses the SAME resolution chain as the decision and activation emails: the
 * real recipient address from the submission data, a deterministic name with
 * the form's actual field labels, and the run → form → platform-default
 * template. Tracked under email_type "acknowledgement" so it appears in the
 * run's email log, ships through the shared transport, and can be retried when
 * it fails — none of which the old fire-and-forget sender did.
 *
 * Returns { status: "sent"|"already_sent"|"failed"|"not_found", error?, to? }.
 */
export async function sendAcknowledgementForSubmission({ submission_id }) {
  const submissionResult = await getDecisionEmailSubmissionById(submission_id);
  if (submissionResult.rows.length === 0) return { status: "not_found", error: "Submission not found" };
  const row = submissionResult.rows[0];

  try {
    const subData = row.data || {};

    // Field labels (submission data is keyed by field id) + the CRM contact,
    // read once so the recipient and the name come from the same sources the
    // run overview uses.
    let labels = {};
    let crmName = "";
    let crmEmail = "";
    try {
      const fieldLabelsResult = await getFieldLabelsByRunId(row.run_id);
      for (const fieldRow of fieldLabelsResult.rows) labels[String(fieldRow.id)] = fieldRow.label;
      const contactRes = await getContactNameEmailByCid(row.submitter_id);
      if (contactRes.rows[0]) {
        crmName = contactRes.rows[0].name || "";
        crmEmail = contactRes.rows[0].email || "";
      }
    } catch (_) {}

    const recipient = resolveSubmissionEmail({ submissionData: subData, fieldLabels: labels, contactEmail: crmEmail });
    if (!recipient) return { status: "failed", error: "No real email address found in the submission data" };

    const applicantName = resolvePersonName({
      contactName: crmName,
      submitterName: row.submitter_name || "",
      submissionData: subData,
      fieldLabels: labels,
    }) || "there";

    // The RUN decides the template; the form is only its default. (Same
    // run+form settings read the decision emails use.)
    const contextResult = await getRunTemplateSettingsForDecisionById(row.run_id);
    const context = contextResult.rows[0] || null;
    const template = getTemplate(context?.settings || {}, "acknowledgement", context?.run_settings || {});

    const tracked = await sendTrackedEmail({
      submission_id: parseInt(submission_id),
      contact_cid: row.submitter_id || null,
      email_type: "acknowledgement",
      to: recipient,
      sendFn: () =>
        sendConfirmationEmail({
          to: recipient,
          applicantName,
          formName: context?.name || "application",
          organization: "ImpactOS",
          template,
        }),
    });

    if (tracked.success) return { status: "sent", to: recipient };
    if (tracked.skipped) return { status: "already_sent", to: recipient };
    return { status: "failed", error: tracked.error || "Email send failed", to: recipient };
  } catch (error) {
    return { status: "failed", error: error?.message || "Confirmation email error" };
  }
}

