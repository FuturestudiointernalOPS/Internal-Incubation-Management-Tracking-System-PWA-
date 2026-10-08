/**
 * Platform — form runs: the tracked DECISION email (SERVICE layer).
 *
 * The approval/rejection email and the shared timeline entry. Split verbatim
 * out of `services/platform/formRuns/resultEmails.js` — see docs/LAYER_SPLIT.md.
 *
 * Layer: decisions and shaping, no SQL, no HTTP.
 */

import {
  getTemplate,
  hasSentEmailToRecipientInRun,
  recordEmailStatus,
  resolvePersonName,
  resolveSubmissionEmail,
  sendDecisionEmail,
} from "@/lib/email";
import { resolveAutomationFlag } from "@/lib/platform/automationSettings";
import {
  getContactNameEmailByCid,
  getDecisionEmailSubmissionById,
  getFieldLabelsByRunId,
  getGroupAssignedToRunById,
  getGroupNameForDecisionEmailByRunId,
  getLatestScoreBySubmissionId,
  getRunTemplateSettingsForDecisionById,
  insertTimelineEntry,
} from "@/models/formRuns";

/** Fire-and-forget timeline entry, used across the review and email flows. */
export function logTimeline(submissionId, action, actorId, actorName, meta = {}) {
  insertTimelineEntry(submissionId, action, actorId, actorName, meta).catch(() => {});
}

/**
 * Send (or re-send) the tracked decision email for a submission using the
 * SAME resolution chain as the approval flow: recipient from submission
 * data, name resolved deterministically with the form's real field labels,
 * run→form→default template, score variable, group gating. Used by both the
 * review workflow and the manual retry action.
 *
 * Returns { status: "sent"|"already_sent"|"skipped"|"failed"|"not_found", error?, to? }.
 */
export async function sendDecisionEmailForSubmission({ submission_id, decision, comment }) {
  const submissionResult = await getDecisionEmailSubmissionById(submission_id);
  if (submissionResult.rows.length === 0) return { status: "not_found", error: "Submission not found" };
  const row = submissionResult.rows[0];

  try {
    const subData = row.data || {};

    // Fetch the form's real field labels + CRM contact once, then resolve
    // BOTH the name and the real applicant email from the same sources so
    // the UI and the sender can never disagree about the recipient.
    let labels = {};
    let crmName = "";
    let crmEmail = "";
    try {
      const fieldLabelsResult = await getFieldLabelsByRunId(row.run_id);
      for (const fieldRow of fieldLabelsResult.rows) labels[String(fieldRow.id)] = fieldRow.label;
      const cNameRes = await getContactNameEmailByCid(row.submitter_id);
      if (cNameRes.rows[0]) {
        crmName = cNameRes.rows[0].name || "";
        crmEmail = cNameRes.rows[0].email || "";
      }
    } catch (_) {}

    // Real applicant email — placeholders (import-…@placeholder…) never used.
    const applicantEmail = resolveSubmissionEmail({
      submissionData: subData,
      fieldLabels: labels,
      contactEmail: crmEmail,
    });
    if (!applicantEmail) return { status: "failed", error: "No real email address found in the submission data" };

    // Duplicate-recipient guard: when the same email address appears in
    // multiple submissions of this run, only ONE decision email is ever sent.
    const alreadyEmailed = await hasSentEmailToRecipientInRun({
      run_id: row.run_id,
      email_type: decision === "approved" ? "approval" : "rejection",
      recipient: applicantEmail,
    });
    if (alreadyEmailed) {
      await recordEmailStatus({
        submission_id: parseInt(submission_id),
        contact_cid: row.submitter_id || null,
        email_type: decision === "approved" ? "approval" : "rejection",
        status: "skipped",
        error: "Skipped — duplicate recipient: an email was already sent to this address for this run",
        to: applicantEmail,
      });
      return { status: "skipped", error: "Duplicate recipient — already emailed in this run", to: applicantEmail };
    }

    // Best real name — resolved deterministically with the form's actual
    // question labels (submission data is keyed by field id).
    const applicantName = resolvePersonName({
      contactName: crmName,
      submitterName: row.submitter_name || "",
      submissionData: subData,
      fieldLabels: labels,
    });

    // ── Should this decision email go out at all? ──
    // The RUN decides; the form is only its default (run → form → on). One read
    // serves both this verdict and the template lookup further down.
    let decisionSettings = null;
    try {
      const settingsResult = await getRunTemplateSettingsForDecisionById(row.run_id);
      decisionSettings = settingsResult.rows[0] || null;
    } catch (_) {}

    let shouldSend = true;
    if (decision === "approved") {
      if (!resolveAutomationFlag(decisionSettings?.settings, decisionSettings?.run_settings, "on_approve.send_approval_email")) {
        await recordEmailStatus({
          submission_id: parseInt(submission_id),
          contact_cid: row.submitter_id || null,
          email_type: "approval",
          status: "skipped",
          error: "Skipped — Approval email switched off for this run",
          to: applicantEmail,
        });
        return { status: "skipped", error: "Approval email switched off for this run", to: applicantEmail };
      }

      // Approval email requires a group (organizational context). With no
      // group, the person stays in the platform/CRM but no email is sent.
      try {
        const grpCheck = await getGroupAssignedToRunById(row.run_id);
        if (grpCheck.rows.length === 0) {
          shouldSend = false;
          await recordEmailStatus({
            submission_id: parseInt(submission_id),
            contact_cid: row.submitter_id || null,
            email_type: "approval",
            status: "skipped",
            error: "Skipped — No group assigned; approval email not sent",
            to: applicantEmail,
          });
          return { status: "skipped", error: "No group assigned; approval email not sent", to: applicantEmail };
        }
      } catch (_) {}
    }
    if (decision !== "approved") {
      if (!resolveAutomationFlag(decisionSettings?.settings, decisionSettings?.run_settings, "on_reject.send_rejection_email")) {
        shouldSend = false;
      }
    }
    if (!shouldSend) return { status: "skipped", error: "Email disabled by workflow settings", to: applicantEmail };

    // Gather template + score for variables
    let decisionTemplate = null;
    let templateVars = null;
    let score = null;
    try {
      const runInfo2 = { rows: decisionSettings ? [decisionSettings] : [] };
      if (runInfo2.rows[0]) {
        const formName = runInfo2.rows[0].name || "";
        decisionTemplate = getTemplate(
          runInfo2.rows[0].settings || {},
          decision === "approved" ? "approval" : "rejection",
          runInfo2.rows[0].run_settings || {}
        );
        templateVars = { form_name: formName };
        try {
          const groupRes = await getGroupNameForDecisionEmailByRunId(row.run_id);
          if (groupRes.rows.length > 0) templateVars.group_name = groupRes.rows[0].group_name;
        } catch (_) {}
      }
      const scoreResult = await getLatestScoreBySubmissionId(submission_id);
      if (scoreResult.rows.length > 0) score = scoreResult.rows[0].overall_score;
    } catch (_) {}

    const { sendTrackedEmail } = await import("@/lib/email");
    const emailType = decision === "approved" ? "approval" : "rejection";
    const tracked = await sendTrackedEmail({
      submission_id: parseInt(submission_id),
      contact_cid: row.submitter_id || null,
      email_type: emailType,
      provider: "gmail",
      to: applicantEmail,
      sendFn: () => sendDecisionEmail({
        to: applicantEmail,
        applicantName,
        formName: templateVars?.form_name || "application",
        decision,
        comment: comment || "",
        template: decisionTemplate,
        templateVars: { ...(templateVars || {}), score: score != null ? String(score) : "" },
      }),
    });
    if (tracked.success) {
      logTimeline(parseInt(submission_id), "email_sent", "system", "System", { to: applicantEmail, decision, retry: true });
      return { status: "sent", to: applicantEmail };
    }
    if (tracked.skipped) return { status: "already_sent", to: applicantEmail };
    logTimeline(parseInt(submission_id), "email_failed", "system", "System", { to: applicantEmail, decision, email_type: emailType, retry: true });
    return { status: "failed", error: tracked.error || "Email send failed", to: applicantEmail };
  } catch (error) {
    console.error("[form-runs] Decision email error:", error);
    return { status: "failed", error: error?.message || "Email error" };
  }
}
