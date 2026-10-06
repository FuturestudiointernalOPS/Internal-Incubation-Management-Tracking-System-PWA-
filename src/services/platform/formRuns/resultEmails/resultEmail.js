/**
 * Platform — form runs: the result email and its scheduled dispatch (SERVICE layer).
 *
 * Split verbatim out of `services/platform/formRuns/resultEmails.js` — see
 * docs/LAYER_SPLIT.md.
 *
 * Layer: decisions and shaping, no SQL, no HTTP.
 */

import {
  ensureEmailLogTable,
  getDesignedTemplate,
  getEmailLogRow,
  hasSentEmailToRecipientInRun,
  recordEmailStatus,
  resolveResultDelayMinutes,
} from "@/lib/email";
import {
  getRunTemplateSettingsForDecisionById,
  listApprovedSubmissionsAwaitingResultEmail,
} from "@/models/formRuns";

import { logTimeline } from "./decisionEmail";
import { buildResultDocument } from "./resultDocument";

/**
 * Send the participant-facing RESULT email (PDF attachment) for a submission.
 *
 * Recipient/name resolution follows the SAME chain as the decision email so
 * the UI and the sender can never disagree; the send is tracked exactly once
 * per submission (email_type "result") and respects the per-run
 * duplicate-recipient guard used by the other workflow emails.
 *
 * Returns { status: "sent"|"already_sent"|"skipped"|"failed"|"not_found", error?, to? }.
 */
export async function sendResultEmailForSubmission({ submission_id }) {
  try {
    const resultDocument = await buildResultDocument({ submission_id });
    if (resultDocument.status !== "ok") return { status: resultDocument.status, error: resultDocument.error };
    const { row, to: applicantEmail, applicantName, lang, pdfBytes, score, projectName, template } = resultDocument;

    // Already emailed for THIS submission → polite already_sent (re-click).
    const existingLog = await getEmailLogRow(parseInt(submission_id), "result");
    if (existingLog && existingLog.status === "sent") {
      return { status: "already_sent", to: existingLog.recipient || applicantEmail };
    }

    // Duplicate-recipient guard: when the same email address appears in
    // multiple submissions of this run, only ONE result email is ever sent.
    const alreadyEmailed = await hasSentEmailToRecipientInRun({
      run_id: row.run_id,
      email_type: "result",
      recipient: applicantEmail,
    });
    if (alreadyEmailed) {
      await recordEmailStatus({
        submission_id: parseInt(submission_id),
        contact_cid: row.submitter_id || null,
        email_type: "result",
        status: "skipped",
        error: "Skipped — duplicate recipient: a result email was already sent to this address for this run",
        to: applicantEmail,
      });
      return { status: "skipped", error: "Duplicate recipient — already emailed in this run", to: applicantEmail };
    }

    // The result text DESIGNED for this run (or its form) takes over the built-in
    // wording. Read without the platform default, because the built-in wording
    // depends on the kind of run — see getDesignedTemplate. A read failure simply
    // leaves the built-in copy in place; it never blocks the send.
    let designedTemplate = { subject: "", body: "" };
    try {
      const settingsResult = await getRunTemplateSettingsForDecisionById(row.run_id);
      const settingsRow = settingsResult.rows[0] || null;
      designedTemplate = getDesignedTemplate(settingsRow?.settings || {}, "result", settingsRow?.run_settings || {});
    } catch (error) {
      console.warn("[form-runs] Result template settings unreadable:", error.message);
    }

    const { sendResultEmail, sendTrackedEmail } = await import("@/lib/email");
    const tracked = await sendTrackedEmail({
      submission_id: parseInt(submission_id),
      contact_cid: row.submitter_id || null,
      email_type: "result",
      provider: "gmail",
      to: applicantEmail,
      sendFn: () =>
        sendResultEmail({
          to: applicantEmail,
          applicantName,
          pdfBuffer: pdfBytes,
          lang,
          runId: row.run_id,
          submissionId: parseInt(submission_id),
          score,
          projectName,
          template,
          designed: designedTemplate,
        }),
    });
    if (tracked.success) {
      logTimeline(parseInt(submission_id), "email_sent", "system", "System", { to: applicantEmail, email_type: "result" });
      return { status: "sent", to: applicantEmail };
    }
    if (tracked.skipped) return { status: "already_sent", to: applicantEmail };
    logTimeline(parseInt(submission_id), "email_failed", "system", "System", { to: applicantEmail, email_type: "result" });
    return { status: "failed", error: tracked.error || "Email send failed", to: applicantEmail };
  } catch (error) {
    console.error("[form-runs] Result email error:", error);
    return { status: "failed", error: error?.message || "Email error" };
  }
}

/**
 * Deliver every result email whose scheduled time has passed.
 *
 * The delay is the RUN's own setting (see resolveResultDelayMinutes): the clock
 * starts at the submission, so a result is "due" once `submitted_at + delay`
 * is in the past. Only approved, evaluated submissions are candidates — the
 * report cannot exist before that, and the query already excludes any
 * submission whose result was sent. Sending goes through
 * sendResultEmailForSubmission, so the per-submission sentinel, the
 * duplicate-recipient guard and the delivery log all apply unchanged: running
 * this twice never sends twice.
 *
 * Returns a small report ({ checked, sent, skipped, failed, not_due }) so a
 * scheduler call can be observed rather than guessed at.
 */
export async function dispatchScheduledResultEmails({ run_id = null } = {}) {
  const summary = { checked: 0, sent: 0, skipped: 0, failed: 0, not_due: 0 };
  try {
    // The candidate query reads platform_email_log; create it first so a fresh
    // database answers with "nothing to send" instead of a missing-table error.
    await ensureEmailLogTable();
    const candidatesResult = await listApprovedSubmissionsAwaitingResultEmail();
    const now = Date.now();
    for (const candidate of candidatesResult.rows || []) {
      if (run_id != null && String(candidate.run_id) !== String(run_id)) continue;
      const delayMinutes = resolveResultDelayMinutes(candidate.form_settings || {}, candidate.run_settings || {});
      // No delay = no automatic send: the operator sends the result by hand.
      if (delayMinutes <= 0) continue;
      const submittedAt = candidate.submitted_at ? new Date(candidate.submitted_at).getTime() : NaN;
      if (!Number.isFinite(submittedAt)) continue;
      summary.checked += 1;
      if (submittedAt + delayMinutes * 60 * 1000 > now) {
        summary.not_due += 1;
        continue;
      }
      const outcome = await sendResultEmailForSubmission({ submission_id: candidate.id });
      if (outcome.status === "sent") summary.sent += 1;
      else if (outcome.status === "already_sent" || outcome.status === "skipped") summary.skipped += 1;
      else summary.failed += 1;
    }
  } catch (error) {
    console.error("[form-runs] Scheduled result dispatch error:", error);
    return { ...summary, error: error?.message || "Scheduled dispatch failed" };
  }
  return summary;
}
