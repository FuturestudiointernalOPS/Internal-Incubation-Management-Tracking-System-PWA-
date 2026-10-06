/**
 * Platform — form runs: the respondent write path (SERVICE layer).
 *
 * How a response lands on a Run and how a wrong address is fixed: the submit /
 * re-save gate (active run, deadline + Auto-Close, multiple-submissions rule,
 * submission limit, frozen decided responses, paid-execution exclusion, scoring
 * and the once-only AI evaluation), the manual add (a super-admin injecting a
 * respondent and resolving them to a real contact) and the email correction that
 * rewrites whichever source every sender reads.
 *
 * Split of `services/platform/formRuns.js` (see docs/LAYER_SPLIT.md): this is the
 * `submitters` slice; the barrel at the original path re-exports the same
 * surface.
 *
 * Layer: decisions and orchestration, no SQL, no HTTP. It reads and writes
 * through `@/models/**` and `@/lib/**`.
 */

import { resolveSubmissionEmail } from "@/lib/email";
import { maybeAutoApprove } from "@/models/platform/ai/autoApprove";
import { onSubmission } from "@/models/platform/automation";
import {
  countNonDraftSubmissionsByRunId,
  findContactByLowerEmailForManualAdd,
  findExistingSubmissionIdForRunAndSubmitter,
  getAssignedGroupForManualAddById,
  getContactNameEmailByCid,
  getFormFieldsForRunById,
  getFormForInsertSubmissionAutomationById,
  getFormForManualAddAutomationById,
  getFormForSubmissionAutomationById,
  getFullRunForInsertSubmissionAutomationById,
  getFullRunForSubmissionAutomationById,
  getRunForManualAddById,
  getRunFormContextBySubmissionId,
  getRunFormIdForEvaluationById,
  getRunFormIdForManualEvaluationById,
  getRunSubmissionGateById,
  getSubmissionById,
  getSubmissionCurrentStatusById,
  insertContactForManualAdd,
  insertManualAddSubmission,
  insertSubmissionForSubmitter,
  updateContactEmailById,
  updateContactNameById,
  updateRunStatusById,
  updateSubmissionContentAndStatusById,
  updateSubmissionDataById,
} from "@/models/formRuns";
import { calculateSubmissionScores } from "@/services/platform/scoring";
import { logTimeline } from "./resultEmails";

// ── Submit / manual-add: the respondent write path ──────────────────────────

/**
 * Submit (or re-save) the session user's response to a run.
 *
 * The rules the controller must not re-implement:
 *   - a run must be ACTIVE, and its deadline (with "Auto-Close") gates answers;
 *   - "Multiple Submissions" off means a repeat save UPDATES the person's own
 *     response; on, it adds a new one;
 *   - "Submission Limit" caps new responses (0 = unlimited); an update is exempt;
 *   - an approved/rejected response is frozen;
 *   - a PAID Execution is never scored or auto-approved here (checkout grants
 *     access after payment).
 *
 * Returns { ok:true, submission } or { ok:false, statusCode, error }.
 */
export async function submitResponse({ run_id, data, status: subStatus, session }) {
  // Check run is active and not closed
  const run = await getRunSubmissionGateById(run_id);
  if (run.rows.length === 0) return { ok: false, statusCode: 404, error: "Run not found" };
  if (run.rows[0].status !== "active") return { ok: false, statusCode: 400, error: "Run is not active" };
  const gateSettings = run.rows[0].settings || {};
  // A PAID Execution captures a registration and nothing else until the money
  // is confirmed, so its responses are never scored or auto-approved here —
  // the checkout flow is what grants access, after payment.
  const sellsCourse = Boolean(run.rows[0].lms_course_id);
  if (run.rows[0].closes_at && new Date(run.rows[0].closes_at) < new Date()) {
    // "Auto-Close" makes the run close ITSELF at its deadline instead of only
    // refusing late answers — the status the operator would set by hand.
    if (gateSettings.auto_close) {
      try { await updateRunStatusById(run_id, "closed"); } catch (_) {}
    }
    return { ok: false, statusCode: 400, error: "Submission deadline has passed" };
  }

  // "Multiple Submissions" off (the default) means one response per person:
  // a repeat save UPDATES that person's own response. On, a repeat save adds
  // a NEW response instead — which is what lets the submission limit below
  // ever be reached by one person.
  const allowMultiple = gateSettings.allow_multiple === true;
  const existing = await findExistingSubmissionIdForRunAndSubmitter(run_id, session.cid);
  const submissionToUpdate = !allowMultiple && existing.rows.length > 0 ? existing : { rows: [] };

  const newStatus = subStatus || "submitted";

  // "Submission Limit" caps how many responses the run accepts (0 =
  // unlimited). Only a NEW response consumes a seat, so updating one's own
  // response is exempt.
  if (newStatus !== "draft" && submissionToUpdate.rows.length === 0) {
    const limit = parseInt(gateSettings.submission_limit) || 0;
    if (limit > 0) {
      const countRes = await countNonDraftSubmissionsByRunId(run_id, session.cid);
      const current = parseInt(countRes.rows[0]?.c) || 0;
      if (current >= limit) {
        return { ok: false, statusCode: 400, error: "platformMisc.runs.submissionLimitReached" };
      }
    }
  }

  // Build final data with optional scoring
  let finalData = { ...(data || {}) };
  // Is AI evaluation switched ON for this form? A FORM-level question: it says
  // nothing about whether THIS response already carries an evaluation. The
  // two were confused, so every re-save re-ran the model and appended a row.
  let formAiEnabled = false;
  if (newStatus === "submitted") {
    const scores = await calculateSubmissionScores(run_id, finalData);
    if (scores) finalData._scores = scores;
    try {
      const { formHasAiEvaluation } = await import("@/models/platform/ai/evaluate");
      const runInfo = await getRunFormIdForEvaluationById(run_id);
      if (runInfo.rows.length > 0) formAiEnabled = await formHasAiEvaluation(runInfo.rows[0].form_id);
    } catch (_) {}
  }

  if (submissionToUpdate.rows.length > 0) {
    const currentStatus = await getSubmissionCurrentStatusById(submissionToUpdate.rows[0].id);
    // Don't allow overwriting approved/rejected submissions
    if (currentStatus.rows[0] && (currentStatus.rows[0].status === "approved" || currentStatus.rows[0].status === "rejected")) {
      return { ok: false, statusCode: 400, error: "Cannot modify an already decided submission" };
    }
    const result = await updateSubmissionContentAndStatusById({
      submissionId: submissionToUpdate.rows[0].id,
      data: finalData,
      status: newStatus,
    });
    logTimeline(submissionToUpdate.rows[0].id, newStatus === "draft" ? "draft_saved" : "submitted", session.cid, null);
    // Fire automation
    if (newStatus !== "draft") {
      const fullRun = await getFullRunForSubmissionAutomationById(run_id);
      const runRow = fullRun.rows[0];
      let formRow = null;
      if (runRow) {
        const formResult = await getFormForSubmissionAutomationById(runRow.form_id);
        formRow = formResult.rows[0] || null;
      }
      onSubmission(result.rows[0], runRow || { id: parseInt(run_id) }, formRow, session);
      // AI evaluation — but ONLY when this response has never been evaluated.
      // Re-evaluating appends a duplicate row AND spends a model call to
      // answer a question that is already answered; the new row carries no
      // human values, so it would also hide whatever a human had entered.
      // If we cannot tell whether it was evaluated, we do NOT evaluate.
      if (formAiEnabled && !sellsCourse) {
        const newSubmissionId = result.rows[0].id;
        try {
          const { submissionHasEvaluation, evaluateSubmission } = await import("@/models/platform/ai/evaluate");
          const alreadyEvaluated = await submissionHasEvaluation(newSubmissionId).catch(() => true);
          if (!alreadyEvaluated) {
            const evaluation = await evaluateSubmission(newSubmissionId);
            logTimeline(newSubmissionId, "ai_evaluated", "system", "System", {});
            // A score that meets the form's cutoff approves the applicant
            // right away — the same automatic step the evaluation endpoint
            // applies, so nothing depends on an administrator opening the run.
            if (evaluation) await maybeAutoApprove(newSubmissionId, evaluation);
          }
        } catch (error) {
          console.error("[form-runs] AI eval failed for submission", newSubmissionId, ":", error.message);
          logTimeline(newSubmissionId, "ai_eval_failed", "system", "System", { error: error.message });
        }
      }
    }
    return { ok: true, submission: result.rows[0] };
  }

  const result = await insertSubmissionForSubmitter({
    runId: run_id,
    submitterId: session.cid,
    submitterName: null,
    status: newStatus,
    data: finalData,
  });
  logTimeline(result.rows[0].id, newStatus === "draft" ? "started" : "submitted", session.cid, null);
  // Fire automation
  if (newStatus !== "draft") {
    const fullRun = await getFullRunForInsertSubmissionAutomationById(run_id);
    const runRow = fullRun.rows[0];
    let formRow = null;
    if (runRow) {
      const formResult = await getFormForInsertSubmissionAutomationById(runRow.form_id);
      formRow = formResult.rows[0] || null;
    }
    onSubmission(result.rows[0], runRow || { id: parseInt(run_id) }, formRow, session);
    // A brand-new response cannot already have an evaluation, so the
    // form-level switch is the whole question here.
    if (formAiEnabled && !sellsCourse) {
      const newSubmissionId = result.rows[0].id;
      try {
        const { evaluateSubmission } = await import("@/models/platform/ai/evaluate");
        const evaluation = await evaluateSubmission(newSubmissionId);
        logTimeline(newSubmissionId, "ai_evaluated", "system", "System", {});
        // Same automatic approval step as every other evaluation path.
        if (evaluation) await maybeAutoApprove(newSubmissionId, evaluation);
      } catch (error) {
        console.error("[form-runs] AI eval failed for submission", newSubmissionId, ":", error.message);
        logTimeline(newSubmissionId, "ai_eval_failed", "system", "System", { error: error.message });
      }
    }
  }
  return { ok: true, submission: result.rows[0] };
}

/**
 * Manual add — a super-admin injects a respondent directly into a run.
 *
 * The submission is created as "approved" by default so the person is
 * immediately eligible for an activation/join email. Pass status:'submitted'
 * (or 'draft') explicitly to exercise the full scoring/review flow.
 *
 * The respondent is resolved to a REAL contact (existing by lower-case email,
 * else created) so the name + email flow through scoring, review and the
 * approval/activation pipeline; a run's group assignment places a new contact
 * in that group, otherwise they stay neutral. Returns { ok:true, submission } or
 * { ok:false, statusCode, error }.
 */
export async function manualAddRespondent({ run_id, name, email, data, status: subStatus, session }) {
  const run = await getRunForManualAddById(run_id);
  if (run.rows.length === 0) return { ok: false, statusCode: 404, error: "Run not found" };

  const cleanName = (name || "").trim();
  const cleanEmail = (email || "").trim().toLowerCase();

  // Resolve/ensure a real contact so the respondent's name + email flow
  // through scoring, review, and the approval/activation email pipeline.
  let submitterId = null;
  if (cleanEmail) {
    const existing = await findContactByLowerEmailForManualAdd(cleanEmail);
    if (existing.rows.length > 0) {
      submitterId = existing.rows[0].cid;
      if (cleanName && !existing.rows[0].name) {
        await updateContactNameById(submitterId, cleanName);
      }
    } else {
      submitterId = "USR_" + Math.random().toString(36).substring(2, 14).toUpperCase();
      // Approved respondents default to Member. If the run carries a
      // group/program assignment, the respondent is placed in that group
      // (its designation applies then); otherwise they stay neutral —
      // never an assumed participant.
      let assignedGroup = null;
      try {
        const assignRes = await getAssignedGroupForManualAddById(run.rows[0].id);
        if (assignRes.rows[0]) {
          assignedGroup = String(assignRes.rows[0].target_id || "").trim().toUpperCase() || null;
        }
      } catch (_) {}
      await insertContactForManualAdd({
        cid: submitterId,
        name: cleanName || cleanEmail,
        email: cleanEmail,
        groupName: assignedGroup,
      });
    }
  } else {
    submitterId = "manual_" + Math.random().toString(36).substring(2, 12);
  }

  const newStatus = subStatus || "approved";

  let finalData = { ...(data || {}) };
  // manual_add CREATES a response, so the form-level switch is the whole
  // question — there is nothing that could already have been evaluated.
  let formAiEnabled = false;
  if (newStatus === "submitted") {
    const scores = await calculateSubmissionScores(run_id, finalData);
    if (scores) finalData._scores = scores;
    try {
      const { formHasAiEvaluation } = await import("@/models/platform/ai/evaluate");
      const runInfo = await getRunFormIdForManualEvaluationById(run_id);
      if (runInfo.rows.length > 0) formAiEnabled = await formHasAiEvaluation(runInfo.rows[0].form_id);
    } catch (_) {}
  }

  const result = await insertManualAddSubmission({
    runId: run_id,
    submitterId,
    submitterName: cleanName || null,
    status: newStatus,
    data: finalData,
  });
  logTimeline(result.rows[0].id, newStatus === "draft" ? "started" : "submitted", session.cid, cleanName || null);

  if (newStatus !== "draft") {
    const runRow = run.rows[0];
    let formRow = null;
    if (runRow) {
      const formResult = await getFormForManualAddAutomationById(runRow.form_id);
      formRow = formResult.rows[0] || null;
    }
    onSubmission(result.rows[0], runRow || { id: parseInt(run_id) }, formRow, session);
    if (formAiEnabled && !runRow?.lms_course_id) {
      const newSubmissionId = result.rows[0].id;
      try {
        const { evaluateSubmission } = await import("@/models/platform/ai/evaluate");
        const evaluation = await evaluateSubmission(newSubmissionId);
        logTimeline(newSubmissionId, "ai_evaluated", "system", "System", {});
        // Same automatic approval step as every other evaluation path.
        if (evaluation) await maybeAutoApprove(newSubmissionId, evaluation);
      } catch (error) {
        console.error("[form-runs] AI eval failed for manual submission", newSubmissionId, ":", error.message);
        logTimeline(newSubmissionId, "ai_eval_failed", "system", "System", { error: error.message });
      }
    }
  }

  return { ok: true, submission: result.rows[0] };
}

// Email correction — a wrong address is fixable after the fact.
//
// `resolveSubmissionEmail` reads the applicant's answer to the form's email
// question first, then the linked CRM contact. Every run sender (the
// acknowledgement, decision, activation and result emails, and the Run view
// itself) goes through that one resolver, so correcting whichever source holds
// the address is what makes the fix take effect everywhere at once.
const RESPONDENT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESPONDENT_EMAIL_LABEL_HINTS = /(e-?mail|courriel|m[eé]l|adresse\s*(e-?mail|mail))/i;

/**
 * Correct the email a run's respondent is contacted at — the fix for an address
 * typed wrong on the form or in a manual add.
 *
 * The stored email ANSWER is rewritten when the form has a labelled email
 * question (the source every sender prefers); otherwise the linked CRM contact
 * is re-pointed at the new address (the fallback every sender reads). The
 * contact is only renamed while the new address is still free — when it already
 * belongs to someone else the submission is still corrected and the conflict is
 * reported, so a correction can never hijack another person's identity.
 *
 * Returns { ok:true, email, data_updated, contact_updated, contact_conflict }
 * or { ok:false, statusCode, error }.
 */
export async function updateRespondentEmail({ run_id, submission_id, email, session }) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!RESPONDENT_EMAIL_PATTERN.test(cleanEmail)) {
    return { ok: false, statusCode: 400, error: "Enter a valid email address." };
  }

  const submissionResult = await getSubmissionById(submission_id);
  const submission = submissionResult.rows[0];
  if (!submission) return { ok: false, statusCode: 404, error: "Submission not found" };
  if (String(submission.run_id) !== String(run_id)) {
    return { ok: false, statusCode: 400, error: "Submission is not in this run" };
  }

  // The Run's form answers are keyed by field id; the labels decide which key is
  // the email question (the same EN/FR hint set the resolver uses).
  const contextResult = await getRunFormContextBySubmissionId(submission_id);
  const formId = contextResult.rows[0]?.form_id ?? null;
  const fieldLabels = {};
  let emailFieldKey = null;
  if (formId != null) {
    const fieldsResult = await getFormFieldsForRunById(formId);
    for (const field of fieldsResult.rows || []) {
      fieldLabels[String(field.id)] = field.label;
      if (emailFieldKey == null && RESPONDENT_EMAIL_LABEL_HINTS.test(String(field.label || ""))) {
        emailFieldKey = String(field.id);
      }
    }
  }

  const previousEmail = resolveSubmissionEmail({ submissionData: submission.data || {}, fieldLabels, contactEmail: "" });
  const data = { ...(submission.data || {}) };
  let dataUpdated = false;

  if (emailFieldKey != null) {
    if (String(data[emailFieldKey] ?? "").trim().toLowerCase() !== cleanEmail) {
      data[emailFieldKey] = cleanEmail;
      dataUpdated = true;
    }
  } else if (previousEmail) {
    // No labelled email question — retarget the value the senders already read.
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string" && value.trim().toLowerCase() === previousEmail) {
        if (previousEmail !== cleanEmail) {
          data[key] = cleanEmail;
          dataUpdated = true;
        }
        break;
      }
    }
  }

  if (dataUpdated) await updateSubmissionDataById(submission_id, data);

  // Keep the CRM identity (the account/activation record) in step. Skipped when
  // the new address is already owned by a DIFFERENT contact — the submission is
  // still corrected, and the conflict is surfaced rather than overwritten.
  let contactUpdated = false;
  let contactConflict = false;
  if (submission.submitter_id) {
    const contactResult = await getContactNameEmailByCid(submission.submitter_id);
    const contact = contactResult.rows[0];
    const contactEmail = String(contact?.email || "").trim().toLowerCase();
    if (contactEmail && contactEmail !== cleanEmail) {
      const existing = await findContactByLowerEmailForManualAdd(cleanEmail);
      const takenByAnother = (existing.rows || []).some((row) => String(row.cid) !== String(submission.submitter_id));
      if (takenByAnother) {
        contactConflict = true;
      } else {
        try {
          await updateContactEmailById(submission.submitter_id, cleanEmail);
          contactUpdated = true;
        } catch (_) {
          contactConflict = true;
        }
      }
    }
  }

  if (!dataUpdated && !contactUpdated && !contactConflict) {
    return { ok: false, statusCode: 400, error: "This run captures no email address to edit." };
  }

  // One audit line so a corrected address is traceable in the submission history.
  logTimeline(
    submission_id,
    "email_corrected",
    session?.cid || null,
    session?.name || null,
    { from: previousEmail || null, to: cleanEmail },
  );

  return {
    ok: true,
    email: cleanEmail,
    data_updated: dataUpdated,
    contact_updated: contactUpdated,
    contact_conflict: contactConflict,
  };
}
