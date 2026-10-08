/**
 * Platform — form runs: the email/message actions (SERVICE layer).
 *
 * The batch actions an administrator runs over a Run's respondents: manual
 * retry of failed sends, cancelling not-yet-attempted sends, the bulk result
 * send, the free-text manual message (Room Overview) and the activation/join
 * send with its force-resend.
 *
 * Split of `services/platform/formRuns.js` (see docs/LAYER_SPLIT.md): this is the
 * `sends` slice; the barrel at the original path re-exports the same surface.
 * It re-sends through the SAME helpers the first send used, so the tracked
 * sentinel and the duplicate-recipient guard apply unchanged.
 *
 * Layer: decisions and orchestration, no SQL, no HTTP. It reads and writes
 * through `@/models/**` and `@/lib/**`.
 */

import {
  getActivationHistory,
  getEmailLogRow,
  isPlaceholderEmail,
  recordEmailStatus,
  resolvePersonName,
  resolveSubmissionEmail,
  sendManualMessage,
} from "@/lib/email";
import { onReview, sendAcknowledgementForSubmission } from "@/models/platform/automation";
import {
  getActivationMessageSubmissionsByIdsInRun,
  getCancelledBatchSubmissionIdsInRun,
  getContactStatusForActivationById,
  getFormForActivationRetryById,
  getFormForActivationSendById,
  getManualMessageFieldLabelsByRunId,
  getManualMessageGroupNameByRunId,
  getManualMessageSubmissionsByIdsInRun,
  getRetryEmailValidationsByIdsInRun,
  getRunDataForActivationRetryById,
  getRunDataForActivationSendById,
  getSubmissionForActivationRetryById,
} from "@/models/formRuns";
import { sendDecisionEmailForSubmission, sendResultEmailForSubmission } from "./resultEmails";

// ── Email actions: retry, cancel, bulk result send ──────────────────────────

/**
 * Retry failed emails — MANUAL only, never automatic. Each selected
 * (submission, email_type) pair must have a FAILED/bounced/cancelled/pending
 * send; a succeeded send is never resent.
 *
 * Re-sends go through the SAME helpers the first send used: approval/rejection
 * through the tracked decision email, `result` through the result sender,
 * acknowledgement through the acknowledgement sender, and `activation` re-fires
 * the REVIEW_COMPLETED automation so contact, token, template and idempotency
 * logic stay identical.
 */
export async function retryFailedEmails({ run_id, retries, session }) {
  // Backend validation: every submission must belong to THIS run.
  const idList = [...new Set(retries.map((retry) => parseInt(retry.submission_id)))];
  const validationsResult = await getRetryEmailValidationsByIdsInRun(idList, run_id);
  const validMap = new Map(validationsResult.rows.map((row) => [row.id, row]));

  const results = [];
  for (const item of retries) {
    const id = parseInt(item.submission_id);
    const type = String(item.email_type);
    const name = validMap.get(id)?.submitter_name || "";
    if (!validMap.has(id)) {
      results.push({ submission_id: id, email_type: type, name, status: "failed", error: "Submission is not in this run" });
      continue;
    }
    const logRow = await getEmailLogRow(id, type);
    if (logRow && logRow.status === "sent") {
      results.push({ submission_id: id, email_type: type, name, status: "already_sent", error: "Email already sent — not resent" });
      continue;
    }
    if (!logRow || !["failed", "bounced", "cancelled", "pending"].includes(logRow.status)) {
      results.push({ submission_id: id, email_type: type, name, status: "skipped", error: "No failed/bounced/cancelled/pending send to retry" });
      continue;
    }

    if (type === "approval" || type === "rejection") {
      const sendResult = await sendDecisionEmailForSubmission({
        submission_id: id,
        decision: type === "approval" ? "approved" : "rejected",
        comment: "",
      });
      results.push({ submission_id: id, email_type: type, name, status: sendResult.status, error: sendResult.error, to: sendResult.to });
    } else if (type === "result") {
      const sendResult = await sendResultEmailForSubmission({ submission_id: id });
      results.push({ submission_id: id, email_type: type, name, status: sendResult.status, error: sendResult.error, to: sendResult.to });
    } else if (type === "acknowledgement") {
      // Submission confirmation — same resolution chain as when it first
      // fired (recipient, name, run → form → default template).
      const sendResult = await sendAcknowledgementForSubmission({ submission_id: id });
      results.push({ submission_id: id, email_type: type, name, status: sendResult.status, error: sendResult.error, to: sendResult.to });
    } else if (type === "activation") {
      try {
        const submissionResult = await getSubmissionForActivationRetryById(id);
        const runData = await getRunDataForActivationRetryById(submissionResult.rows[0]?.run_id);
        let formData = null;
        if (runData.rows[0]) {
          const formResult = await getFormForActivationRetryById(runData.rows[0].form_id);
          formData = formResult.rows[0] || null;
        }
        await onReview(
          { id: null, submission_id: id, decision: "approved", comment: "Manual email retry", reviewer_name: session.cid },
          submissionResult.rows[0],
          runData.rows[0] || null,
          session,
          formData
        );
        const after = await getEmailLogRow(id, "activation");
        results.push({
          submission_id: id,
          email_type: "activation",
          name,
          status: after?.status === "sent" ? "sent" : after?.status === "failed" ? "failed" : "skipped",
          error: after?.status === "failed" ? (after.error || "Activation email failed") : undefined,
          to: after?.recipient,
        });
      } catch (error) {
        results.push({ submission_id: id, email_type: "activation", name, status: "failed", error: error?.message || "Retry error" });
      }
    } else {
      results.push({ submission_id: id, email_type: type, name, status: "failed", error: `Unsupported email type: ${type}` });
    }
  }

  return { results };
}

/**
 * Mark a batch of NOT-attempted (submission, email_type) pairs as cancelled.
 * An already-sent pair is never touched, so history is preserved and a
 * successful send is never overwritten. Returns the count marked.
 */
export async function markEmailsCancelled({ run_id, items }) {
  const idList = [...new Set(items.map((item) => parseInt(item?.submission_id)).filter((numericId) => Number.isFinite(numericId)))];
  const validationsResult = await getCancelledBatchSubmissionIdsInRun(idList, run_id);
  const validSet = new Set(validationsResult.rows.map((row) => row.id));

  let marked = 0;
  for (const item of items) {
    const id = parseInt(item?.submission_id);
    const type = String(item?.email_type || "");
    if (!Number.isFinite(id) || !type || !validSet.has(id)) continue;
    const logRow = await getEmailLogRow(id, type);
    if (logRow && logRow.status === "sent") continue; // never touch successful sends
    await recordEmailStatus({
      submission_id: id,
      contact_cid: logRow?.contact_cid || null,
      email_type: type,
      status: "cancelled",
      error: "Cancelled by administrator before send",
      to: logRow?.recipient || null,
    });
    marked++;
  }
  return { marked };
}

/**
 * Send each selected applicant their response PDF (answers, evaluation feedback,
 * final score) through the same per-submission result sender as retries —
 * tracked once per submission, draft/no-evaluation submissions reported as
 * skipped/failed. The PDF/copy never mention AI or the form/run names.
 */
export async function sendResultEmails({ run_id, submission_ids }) {
  const idList = [...new Set(submission_ids.map((id) => parseInt(id)).filter((numericId) => Number.isFinite(numericId)))];
  const validationsResult = await getManualMessageSubmissionsByIdsInRun(idList, run_id);
  const validMap = new Map(validationsResult.rows.map((row) => [row.id, row]));

  const results = [];
  for (const id of idList) {
    const submission = validMap.get(id);
    if (!submission) {
      results.push({ submission_id: id, name: "", status: "failed", error: "Submission is not in this run" });
      continue;
    }
    const sendResult = await sendResultEmailForSubmission({ submission_id: id });
    results.push({ submission_id: id, name: submission.submitter_name || "", status: sendResult.status || "failed", error: sendResult.error, to: sendResult.to });
  }

  return { results };
}

// ── Messaging: manual free-text and activation sends ─────────────────────────

/**
 * Send a free-text message to selected respondents of a run (Room Overview).
 * The recipient email and person name are resolved from the submission data with
 * the form's real field labels; a placeholder or missing address fails that
 * recipient only, never the batch. Returns { batch_id, recipients, sent, failed,
 * results } — the same envelope the UI already consumes.
 */
export async function sendManualMessages({ run_id, submission_ids, subject, body: messageBody, cc = [] }) {
  const batchId = "msg_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  const idList = [...new Set(submission_ids.map((id) => parseInt(id)).filter((numericId) => Number.isFinite(numericId)))];
  const validationsResult = await getManualMessageSubmissionsByIdsInRun(idList, run_id);
  const validMap = new Map(validationsResult.rows.map((row) => [row.id, row]));

  // Fetch the form's field labels once for identity resolution.
  let fieldLabels = {};
  try {
    const fieldLabelsResult = await getManualMessageFieldLabelsByRunId(run_id);
    for (const fieldRow of fieldLabelsResult.rows) fieldLabels[String(fieldRow.id)] = fieldRow.label;
  } catch (_) {}

  let groupName = null;
  try {
    const groupResult = await getManualMessageGroupNameByRunId(run_id);
    if (groupResult.rows.length > 0) groupName = groupResult.rows[0].name;
  } catch (_) {}

  const results = [];
  let sent = 0;
  let failed = 0;

  for (const id of idList) {
    const submission = validMap.get(id);
    if (!submission) {
      results.push({ submission_id: id, status: "failed", error: "Submission is not in this run" });
      failed++;
      continue;
    }

    const subData = submission.data || {};
    const contactEmail = resolveSubmissionEmail({ submissionData: subData, fieldLabels, contactEmail: "" });
    if (!contactEmail || isPlaceholderEmail(contactEmail)) {
      results.push({ submission_id: id, name: submission.submitter_name || "", status: "failed", error: "No usable recipient email" });
      failed++;
      continue;
    }

    const name = resolvePersonName({
      contactName: "",
      submitterName: submission.submitter_name || "",
      submissionData: subData,
      fieldLabels,
    }) || submission.submitter_name || "Participant";

    const sendResult = await sendManualMessage({
      to: contactEmail,
      cc,
      name,
      subject,
      body: messageBody,
      submission_id: id,
      contact_cid: submission.submitter_id || null,
      batch_id: batchId,
      templateVars: {
        form_name: "",
        group_name: groupName || "",
      },
    });

    if (sendResult.success) {
      sent++;
      results.push({ submission_id: id, name, status: "sent", to: contactEmail });
    } else {
      failed++;
      results.push({ submission_id: id, name, status: "failed", error: sendResult.error || "Send failed", to: contactEmail });
    }
  }

  return { batch_id: batchId, recipients: idList.length, sent, failed, results };
}

/**
 * Send (or, with `force`, re-send) the activation/join email to selected
 * APPROVED respondents of a run. The send runs through the same REVIEW_COMPLETED
 * automation the approval flow uses, so the token, template and idempotency
 * logic are identical; `force` bypasses the once-per-submission dedup so a fresh
 * link can be issued after the previous one expired. A missing/closed response,
 * a not-approved response or an already-active account is skipped, not failed.
 */
export async function sendActivationMessages({ run_id, submission_ids, force, session }) {
  const forceResend = force === true || force === 1 || force === "true" || force === "1";

  // Backend validation: every submission must belong to THIS run.
  const idList = [...new Set(submission_ids.map((id) => parseInt(id)))];
  const validationsResult = await getActivationMessageSubmissionsByIdsInRun(idList, run_id);
  const validMap = new Map(validationsResult.rows.map((row) => [row.id, row]));

  const results = [];
  for (const id of idList) {
    const submission = validMap.get(id);
    if (!submission) {
      results.push({ submission_id: id, name: "", status: "failed", error: "Submission is not in this run" });
      continue;
    }
    const name = submission.submitter_name || "";
    if (String(submission.status || "").toLowerCase() !== "approved") {
      results.push({ submission_id: id, name, status: "skipped", error: "Submission is not approved" });
      continue;
    }

    const logRow = await getEmailLogRow(id, "activation");
    if (!forceResend && logRow && logRow.status === "sent") {
      results.push({ submission_id: id, name, status: "already_sent", error: "Activation email already sent" });
      continue;
    }

    // Account already activated → no activation email needed. This avoids
    // the misleading "Send failed" when the person already completed setup.
    try {
      const actCheck = await getContactStatusForActivationById(submission.submitter_id);
      if (actCheck.rows[0] && String(actCheck.rows[0].status || "").toLowerCase() === "active") {
        results.push({ submission_id: id, name, status: "skipped", error: "Account already activated — no activation email needed" });
        continue;
      }
    } catch (_) {}

    try {
      const runData = await getRunDataForActivationSendById(submission.run_id);
      let formData = null;
      if (runData.rows[0]) {
        const formResult = await getFormForActivationSendById(runData.rows[0].form_id);
        formData = formResult.rows[0] || null;
      }
      // Force resend bypasses the once-per-submission dedup so an admin can
      // issue a fresh activation link after the previous 48h link expired.
      const reviewSubmission = forceResend ? { ...submission, _forceActivationResend: true } : submission;
      await onReview(
        { id: null, submission_id: id, decision: "approved", comment: forceResend ? "Manual activation resend" : "Manual activation send", reviewer_name: session.cid },
        reviewSubmission,
        runData.rows[0] || null,
        session,
        formData
      );
      const after = await getEmailLogRow(id, "activation");
      const hist = await getActivationHistory({ submission_id: id, contact_cid: submission.submitter_id || null });
      results.push({
        submission_id: id,
        name,
        status: after?.status === "sent" ? "sent" : after?.status === "failed" ? "failed" : "skipped",
        error: after?.status === "failed" || !after
          ? (after?.error || "Activation email failed")
          : after?.status === "pending"
            ? "Activation send did not complete — check the Emails tab"
            : after?.error || undefined,
        to: after?.recipient,
        first_sent_at: hist.first_sent_at,
        last_sent_at: hist.last_sent_at,
        token_valid: hist.token_valid,
        token_expires_at: hist.token_expires_at,
      });
    } catch (error) {
      results.push({ submission_id: id, name, status: "failed", error: error?.message || "Activation send error" });
    }
  }

  return { results };
}
