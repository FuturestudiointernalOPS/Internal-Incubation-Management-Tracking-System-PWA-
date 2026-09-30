/**
 * AUTO-APPROVAL BY SCORE CUTOFF
 *
 * A submission whose AI score reaches the form's cutoff is approved without a
 * human, then onboarded through the SAME review automation a human approval
 * uses (activation/access email, program enrollment, group assignment).
 *
 * Division of ownership, exactly as elsewhere:
 *   • the FORM owns the SCORING POLICY — whether auto-approval is on and the
 *     cutoff to compare against;
 *   • the RUN owns the MESSAGES — run → form → on. So the approval email obeys
 *     `on_approve.send_approval_email` here too: a run that switched the
 *     approval email off must not be emailed by the automatic path either.
 *
 * This lives in the model layer because several callers need the same
 * behaviour: the evaluation endpoint (single + batch) and every path that
 * evaluates a submission the moment it arrives (an applicant submitting from
 * the public link, staff adding a respondent by hand).
 */

import {
  approveSubmissionAndReturn,
  findHigherScoredDuplicateSubmissions,
  getContactNameByCid,
  getFieldLabelsForApprovalEmail,
  getFieldLabelsForDuplicateGuard,
  getFormForAutoApprove,
  getGroupNameForRun,
  getRunForAutoApprove,
  getSubmissionForAutoApprove,
  insertAutoApprovalReview,
} from "@/models/platformAi";
import {
  getTemplate,
  recordEmailStatus,
  resolvePersonName,
  resolveSubmissionEmail,
  sendDecisionEmail,
  sendTrackedEmail,
} from "@/lib/email";
import { onReview } from "@/lib/platform/automation";
import { resolveAutomationFlag } from "@/lib/platform/automationSettings";

/** The group linked to a run (used for the approval email's organisational context). */
async function getRunGroupName(runId) {
  try {
    const groupResult = await getGroupNameForRun(runId);
    return groupResult.rows[0]?.name || null;
  } catch (_) {
    return null;
  }
}

/**
 * Approve `submissionId` when its score meets the form's configured cutoff.
 *
 * @param {number|string} submissionId
 * @param {object|null} evaluation  the evaluation just produced for it
 * @returns {Promise<void>}
 */
export async function maybeAutoApprove(submissionId, evaluation) {
  try {
    const submissionResult = await getSubmissionForAutoApprove(submissionId);
    if (submissionResult.rows.length === 0) return;
    const submission = submissionResult.rows[0];
    if (submission.status !== "submitted") return; // never override existing decision

    const runResult = await getRunForAutoApprove(submission.run_id);
    if (runResult.rows.length === 0) return;

    const formResult = await getFormForAutoApprove(runResult.rows[0].form_id);
    if (formResult.rows.length === 0) return;

    const automation = (formResult.rows[0].settings || {}).automation;
    const cutoff = automation?.auto_approve_cutoff;
    const autoApproveEnabled = automation?.auto_approve === true;
    if (!autoApproveEnabled || cutoff == null || isNaN(parseFloat(cutoff))) return;

    const score = parseFloat(evaluation?.overall_score);
    if (isNaN(score) || score < parseFloat(cutoff)) return;

    // ── DUPLICATE GUARD: when the same email appears in multiple submissions
    // of this run, only the HIGHEST-scored one is auto-approved — lower-scored
    // duplicates stay submitted and never receive an email.
    const subData = submission.data || {};
    // Fetch the form's field labels once — the real applicant email is
    // resolved label-aware (EN/FR), never from placeholder values.
    let labels = {};
    try {
      const fieldLabelsResult = await getFieldLabelsForDuplicateGuard(formResult.rows[0].id);
      for (const fieldRow of fieldLabelsResult.rows) labels[String(fieldRow.id)] = fieldRow.label;
    } catch (_) {}
    const applicantEmail = resolveSubmissionEmail({
      submissionData: subData,
      fieldLabels: labels,
      contactEmail: submission.submitter_id && submission.submitter_id.includes("@") ? submission.submitter_id : "",
    });
    if (applicantEmail) {
      try {
        const siblings = await findHigherScoredDuplicateSubmissions(submission.run_id, submissionId, applicantEmail);
        const better = siblings.rows.find((sibling) => {
          const siblingScore = parseFloat(sibling.overall_score);
          return !isNaN(siblingScore) && siblingScore > score;
        });
        if (better) {
          await recordEmailStatus({
            submission_id: submissionId,
            contact_cid: submission.submitter_id || null,
            email_type: "approval",
            status: "skipped",
            error: "Skipped — duplicate email: a higher-scored submission with the same email exists in this run",
            to: applicantEmail,
          });
          console.log("[Auto-Approve] Skipped (lower-scored duplicate):", applicantEmail, "vs submission", better.id);
          return;
        }
      } catch (_) {}
    }

    // Approve through the same path a human reviewer uses
    const comment = `Auto-approved: AI score ${score} meets cutoff ${cutoff}`;

    // Record review row (system reviewer)
    await insertAutoApprovalReview(submissionId, comment);

    // Update submission status
    const updated = await approveSubmissionAndReturn(submissionId);
    if (updated.rows.length === 0) return; // raced with another decision

    // The RUN decides whether the approval email goes out (run → form → on) —
    // the very same switch the manual approval honours. Without this check the
    // automatic path emailed a run whose approval email was switched off.
    const approvalEmailOn = resolveAutomationFlag(
      formResult.rows[0].settings,
      runResult.rows[0].settings,
      "on_approve.send_approval_email",
    );

    // Send the TRACKED approval email (Gmail transport) with template variables
    // so auto-approved applicants receive the personalized approval template.
    try {
      const approvedData = updated.rows[0].data || {};
      // Fetch the form's field labels once — used for the real applicant
      // email (label-aware, EN/FR) and the name resolution below.
      let approvalLabels = {};
      try {
        const fieldLabelsResult = await getFieldLabelsForApprovalEmail(formResult.rows[0].id);
        for (const fieldRow of fieldLabelsResult.rows) approvalLabels[String(fieldRow.id)] = fieldRow.label;
      } catch (_) {}
      const email = resolveSubmissionEmail({
        submissionData: approvedData,
        fieldLabels: approvalLabels,
        contactEmail: updated.rows[0].submitter_id && updated.rows[0].submitter_id.includes("@") ? updated.rows[0].submitter_id : "",
      });
      if (email) {
        const groupName = await getRunGroupName(runResult.rows[0].id);

        // The approval email only goes out when the run still sends it AND the
        // run carries an organisational context (a group). Otherwise the
        // approval stays in the platform/CRM, the reason is logged, and the
        // applicant is not emailed.
        if (!approvalEmailOn) {
          await recordEmailStatus({
            submission_id: submissionId,
            contact_cid: updated.rows[0].submitter_id || null,
            email_type: "approval",
            status: "skipped",
            error: "Skipped — Approval email switched off for this run",
            to: email,
          });
        } else if (!groupName) {
          await recordEmailStatus({
            submission_id: submissionId,
            contact_cid: updated.rows[0].submitter_id || null,
            email_type: "approval",
            status: "skipped",
            error: "Skipped — No group assigned; approval email not sent",
            to: email,
          });
        } else {
          const decisionTemplate = getTemplate(formResult.rows[0].settings || {}, "approval", runResult.rows[0].settings || {});
          const formName = formResult.rows[0].name || "";

          // Best real name — resolved deterministically with the form's actual
          // question labels; never "Unknown" when a real name exists.
          let applicantName = "";
          try {
            const contactResult = await getContactNameByCid(updated.rows[0].submitter_id);
            applicantName = resolvePersonName({
              contactName: contactResult.rows[0]?.name || "",
              submitterName: updated.rows[0].submitter_name || "",
              submissionData: approvedData,
              fieldLabels: approvalLabels,
            });
          } catch (_) {}

          await sendTrackedEmail({
            submission_id: submissionId,
            contact_cid: updated.rows[0].submitter_id || null,
            email_type: "approval",
            provider: "gmail",
            to: email,
            sendFn: () =>
              sendDecisionEmail({
                to: email,
                applicantName,
                formName,
                decision: "approved",
                comment,
                template: decisionTemplate,
                templateVars: {
                  form_name: formName,
                  score: String(score),
                  group_name: groupName || "",
                  name: applicantName,
                },
              }),
          });
        }
      }
    } catch (error) {
      console.error("[Auto-Approve] Approval email error:", error.message);
    }

    // Fire the same REVIEW_COMPLETED automation (group + activation emails).
    // The activation/enrollment/group switches inside it resolve run → form.
    try {
      await onReview(
        { id: null, submission_id: submissionId, decision: "approved", comment, reviewer_name: "System Auto-Approval" },
        updated.rows[0],
        runResult.rows[0],
        { cid: "system", role: "system" },
        formResult.rows[0]
      );
    } catch (error) {
      console.error("[Auto-Approve] Automation error:", error.message);
    }
  } catch (error) {
    console.error("[Auto-Approve] Error:", error.message);
  }
}

export default { maybeAutoApprove };
