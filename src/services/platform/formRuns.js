/**
 * PLATFORM FORM RUNS — decisions, extracted from the controller.
 *
 * Slice 1 of the platform lane (L1): the review/decision/email/result-document
 * cluster that `src/app/api/platform/form-runs/route.js` used to define inline.
 * Moved here VERBATIM — no SQL, no HTTP (`next/server`/`NextResponse`), no
 * reformatting of the logic itself. The route now imports these functions
 * instead of defining them, and keeps authenticating/validating/shaping the
 * response.
 *
 * See docs/GUIDE_DECOUPAGE_COUCHES.md for the method.
 */

import { after } from "next/server";
import {
  sendDecisionEmail,
  getTemplate,
  getDesignedTemplate,
  resolveResultDelayMinutes,
  ensureEmailLogTable,
  resolvePersonName,
  resolveSubmissionEmail,
  resolveProjectName,
  recordEmailStatus,
  isGenericName,
  hasSentEmailToRecipientInRun,
  detectLanguage,
  getEmailLogRow,
} from "@/lib/email";
import { onReview } from "@/lib/platform/automation";
import { resolveAutomationFlag } from "@/lib/platform/automationSettings";
import { syncApprovedSubmissionToProgramGroup } from "@/lib/contact-group-sync";
import {
  insertTimelineEntry,
  getContactsForAssignmentEnrichment,
  getFamiliesForAssignmentEnrichment,
  getProgramsForAssignmentEnrichment,
  getRunScoringSettingsById,
  getFormScoringSettingsById,
  getSubmissionReviewsBySubmissionId,
  listApprovedSubmissionsAwaitingResultEmail,
  getDecisionEmailSubmissionById,
  getFieldLabelsByRunId,
  getContactNameEmailByCid,
  getGroupAssignedToRunById,
  getRunTemplateSettingsForDecisionById,
  getGroupNameForDecisionEmailByRunId,
  getLatestScoreBySubmissionId,
  getRunFormContextBySubmissionId,
  getLatestEvaluationBySubmissionId,
  getSubmissionReviewStateById,
  getReviewerNameByCid,
  createSubmissionReview,
  getLatestEvaluationForOverridesBySubmissionId,
  updateEvaluationDimensionsById,
  updateSubmissionStatusById,
  getSubmissionRunIdById,
  getRunDataForReviewAutomationById,
  getFormById,
} from "@/models/formRuns";
import { getPlatformFormSections, getPlatformFormFields } from "@/models/forms";
import { getRunReportFileTextByRunId } from "@/models/platform/reportFiles";
import { onSubmission, onAssignmentAdded, sendAcknowledgementForSubmission } from "@/lib/platform/automation";
import { maybeAutoApprove } from "@/models/platform/ai/autoApprove";
import {
  getRunSubmissionGateById,
  updateRunStatusById,
  findExistingSubmissionIdForRunAndSubmitter,
  countNonDraftSubmissionsByRunId,
  getRunFormIdForEvaluationById,
  getSubmissionCurrentStatusById,
  updateSubmissionContentAndStatusById,
  getFullRunForSubmissionAutomationById,
  getFormForSubmissionAutomationById,
  insertSubmissionForSubmitter,
  getFullRunForInsertSubmissionAutomationById,
  getFormForInsertSubmissionAutomationById,
  getRunForManualAddById,
  findContactByLowerEmailForManualAdd,
  updateContactNameById,
  getAssignedGroupForManualAddById,
  insertContactForManualAdd,
  getRunFormIdForManualEvaluationById,
  insertManualAddSubmission,
  getFormForManualAddAutomationById,
  insertRunAssignmentForAction,
  getAssignmentsAfterAssignByRunId,
  getFullRunAfterAssignById,
  getRunIdByAssignmentId,
  deleteAssignmentById,
  getAssignmentsAfterUnassignByRunId,
  getBulkReviewValidationsByIdsInRun,
  getRetryEmailValidationsByIdsInRun,
  getSubmissionForActivationRetryById,
  getRunDataForActivationRetryById,
  getFormForActivationRetryById,
  getCancelledBatchSubmissionIdsInRun,
  getManualMessageSubmissionsByIdsInRun,
  getManualMessageFieldLabelsByRunId,
  getManualMessageGroupNameByRunId,
  getActivationMessageSubmissionsByIdsInRun,
  getContactStatusForActivationById,
  getRunDataForActivationSendById,
  getFormForActivationSendById,
} from "@/models/formRuns";

export function logTimeline(submissionId, action, actorId, actorName, meta = {}) {
  insertTimelineEntry(submissionId, action, actorId, actorName, meta).catch(() => {});
}

/**
 * Resolve display names for run assignments server-side so the UI never has
 * to match against a partial client-side contact list (which previously fell
 * back to raw target IDs / placeholder names for contacts beyond the first
 * 200 loaded into the page).
 *
 * - user    -> contacts by cid OR email (generic placeholder names such as
 *              "Unknown" fall back to the contact email, then null)
 * - group   -> families by registration_id OR id
 * - program -> v2_programs by id
 *
 * Adds target_name / target_email to each assignment row (mutates in place).
 */
export async function enrichAssignments(assignments) {
  const rows = Array.isArray(assignments) ? assignments : assignments?.rows || [];
  if (rows.length === 0) return rows;

  const byType = (targetType) => rows.filter((row) => row.target_type === targetType).map((row) => row.target_id).filter(Boolean);

  const userMap = new Map();
  const groupMap = new Map();
  const programMap = new Map();

  const userIds = byType('user');
  if (userIds.length > 0) {
    try {
      const emails = userIds.map((userId) => String(userId).toLowerCase());
      const contactsResult = await getContactsForAssignmentEnrichment(userIds, emails);
      for (const row of contactsResult.rows) {
        userMap.set(row.cid, row);
        if (row.email) userMap.set(String(row.email).toLowerCase(), row);
      }
    } catch (_) {}
  }

  const groupIds = byType('group');
  if (groupIds.length > 0) {
    try {
      const familiesResult = await getFamiliesForAssignmentEnrichment(groupIds);
      for (const row of familiesResult.rows) {
        if (row.registration_id) groupMap.set(row.registration_id, row);
        groupMap.set(String(row.id), row);
      }
    } catch (_) {}
  }

  const programIds = byType('program');
  if (programIds.length > 0) {
    try {
      const programsResult = await getProgramsForAssignmentEnrichment(programIds);
      for (const row of programsResult.rows) programMap.set(String(row.id), row);
    } catch (_) {}
  }

  for (const assignment of rows) {
    if (assignment.target_type === 'user') {
      const user = userMap.get(assignment.target_id) || userMap.get(String(assignment.target_id).toLowerCase());
      if (user) {
        assignment.target_email = user.email || null;
        assignment.target_name = user.name && !isGenericName(user.name) ? user.name : user.email || null;
      } else {
        assignment.target_name = null;
        assignment.target_email = null;
      }
    } else if (assignment.target_type === 'group') {
      const group = groupMap.get(assignment.target_id) || groupMap.get(String(assignment.target_id).toLowerCase());
      assignment.target_name = group ? group.name || null : null;
    } else if (assignment.target_type === 'program') {
      const program = programMap.get(assignment.target_id) || programMap.get(String(assignment.target_id).toLowerCase());
      assignment.target_name = program ? program.name || null : null;
    }
  }
  return rows;
}

/**
 * Calculate assessment scores for a submission.
 * Expects submissionData to contain rating field values keyed by field label.
 * Returns { sections, overall, ranking } or null if scoring is not configured.
 */
/**
 * Derives the standardized account status for a submission from its matched
 * Contact row. Status-based only: password existence is NOT treated as proof
 * of activation — 'approved' remains approved until the account is 'active'.
 */
export function deriveAccountStatus(contactRow) {
  if (!contactRow) return "not_created";
  if (Number(contactRow.deleted) === 1 || contactRow.deleted_at) return "deleted";
  if (contactRow.archived_at) return "archived";
  const st = String(contactRow.status || "").toLowerCase();
  if (st === "inactive") return "inactive";
  if (st === "active") return "active";
  if (st === "approved") return "activation_pending";
  if (st === "pending") return "pending_approval";
  return "pending_approval";
}

export async function calculateSubmissionScores(runId, submissionData) {
  try {
    const run = await getRunScoringSettingsById(runId);
    if (run.rows.length === 0) return null;

    // Check run-level scoring config first, then fall back to form-level
    const runSettings = run.rows[0].settings || {};
    let scoring = runSettings.scoring;

    if (!scoring || !scoring.enabled) {
      const form = await getFormScoringSettingsById(run.rows[0].form_id);
      if (form.rows.length === 0) return null;
      const formSettings = form.rows[0].settings || {};
      scoring = formSettings.scoring;
    }

    if (!scoring || !scoring.enabled || !scoring.sections) return null;

    const { sections, rankings } = scoring;
    const maxPerQuestion = scoring.max_per_question || 5; // configurable scale (default 5 for Likert)
    const sectionResults = {};

    for (const [sectionName, sectionConfig] of Object.entries(sections)) {
      const { weight, field_labels, max_per_question: sectionMax } = sectionConfig;
      const effectiveMax = sectionMax || maxPerQuestion;
      let sectionTotal = 0;
      let sectionCount = 0;

      if (Array.isArray(field_labels)) {
        for (const label of field_labels) {
          const value = submissionData[label];
          if (value !== undefined && value !== null && value !== "") {
            const numVal = parseFloat(value);
            if (!isNaN(numVal)) {
              sectionTotal += numVal;
              sectionCount++;
            }
          }
        }
      }

      const maxPossible = sectionCount * effectiveMax;
      const sectionScore = sectionCount > 0 ? Math.round((sectionTotal / maxPossible) * 1000) / 10 : 0;

      sectionResults[sectionName] = {
        score: sectionScore,
        maxPossible,
        total: sectionTotal,
        count: sectionCount,
        weight: weight || 0,
      };
    }

    // Overall weighted score
    let overallScore = 0;
    for (const [, data] of Object.entries(sectionResults)) {
      overallScore += data.score * (data.weight / 100);
    }
    overallScore = Math.round(overallScore * 10) / 10;

    // Ranking
    let ranking = null;
    if (Array.isArray(rankings)) {
      for (const rank of rankings) {
        if (overallScore >= rank.min && overallScore <= rank.max) {
          ranking = rank.label;
          break;
        }
      }
    }

    return { sections: sectionResults, overall: overallScore, ranking };
  } catch (error) {
    console.error("[Scoring] Calculation failed:", error.message);
    return null;
  }
}

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

/** Render one submission answer value for the result PDF (phone JSON → text). */
export function formatResultAnswer(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "string") {
    const trimmedValue = value.trim();
    if (trimmedValue.startsWith("{") && trimmedValue.includes('"code"')) {
      try {
        const parsedCode = JSON.parse(trimmedValue);
        if (parsedCode.code && parsedCode.number) return `${parsedCode.code} ${parsedCode.number}`;
      } catch (_) {}
    }
    return trimmedValue;
  }
  if (Array.isArray(value)) return value.map(formatResultAnswer).filter(Boolean).join(", ");
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (_) {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Does this run send the Founder Fit Score result email?
 *
 * The Founder Fit Score run gets a report-specific message; every other run
 * keeps the neutral copy. The form name is the stable signal — the seeded form
 * is "Founder Fit Score Assessment" — with the run name as a fallback so a run
 * created from a renamed copy still matches.
 */
export function isFounderFitResultRun(ctx) {
  return /founder\s*fit/i.test(`${ctx?.form_name || ""} ${ctx?.run_name || ""}`);
}

/**
 * Build the participant-facing RESULT document for a submission — the
 * applicant's answers, the evaluation feedback and the final score. The
 * document never references how the evaluation was produced (the applicant
 * must not learn an automated evaluation ran).
 *
 * Nothing is sent and nothing is recorded: the sender AND the read-only
 * preview shown before sending both call this builder, so what the reviewer
 * sees and what the applicant receives can never disagree.
 *
 * Returns { status: "ok", pdfBytes, lang, applicantName, to, row, score, projectName, template }
 *      or { status: "not_found"|"failed", error }.
 *
 * When the run carries an Output Instruction, the report is composed by AI from
 * the same run data and shaped by that instruction. The composed document is
 * STORED and reused while the state and instruction are unchanged, so this — the
 * single builder both preview and send call — still yields identical bytes for
 * both. Without an instruction nothing changes.
 */
export async function buildResultDocument({ submission_id, forceReport = false }) {
  const submissionResult = await getDecisionEmailSubmissionById(submission_id);
  if (submissionResult.rows.length === 0) return { status: "not_found", error: "Submission not found" };
  const row = submissionResult.rows[0];

  if (String(row.status || "") === "draft") {
    return { status: "failed", error: "Cannot send a result for a draft submission" };
  }

  // The run + form this submission belongs to. This one read is what tells a
  // Founder Fit run from every other one, AND it supplies the field labels, the
  // run settings and the run id the report itself is built from.
  //
  // It used to be wrapped in `catch (_) {}`, so any failure fell through to
  // `ctx = null` and silently sent the NEUTRAL copy with a stripped-down
  // document — nothing in the UI, the timeline or the logs said so.
  //
  // A read failure, or a submission that resolves to no run/form at all, now
  // refuses the send instead of downgrading it: a quietly wrong participant
  // email is worse than a visible, retryable error. A submission always has a
  // run and a form (both foreign keys are NOT NULL), so either outcome here
  // means something is genuinely broken.
  let ctx = null;
  try {
    const ctxResult = await getRunFormContextBySubmissionId(submission_id);
    ctx = ctxResult.rows[0] || null;
  } catch (error) {
    console.error(`[form-runs] Run/form context read failed for submission ${submission_id}:`, error);
    return {
      status: "failed",
      error: "Could not read the run and form this submission belongs to — no result sent. Retry; if it keeps failing, the submission's run or its form is missing.",
    };
  }
  if (!ctx) {
    console.error(`[form-runs] Submission ${submission_id} resolves to no run/form context — run or form missing`);
    return {
      status: "failed",
      error: "This submission's run or form could not be found — no result sent.",
    };
  }

  // A result document requires an evaluation (dimensions + overall score).
  const evaluationResult = await getLatestEvaluationBySubmissionId(submission_id);
  if (evaluationResult.rows.length === 0) {
    return { status: "failed", error: "This submission has not been evaluated yet — run the evaluation first" };
  }
  const evalRow = evaluationResult.rows[0];
  let rawDims = Array.isArray(evalRow.dimensions) ? evalRow.dimensions : [];
  if (!rawDims.length && typeof evalRow.dimensions === "string") {
    try {
      rawDims = JSON.parse(evalRow.dimensions) || [];
    } catch (_) {}
  }
  if (evalRow.overall_score == null && rawDims.length === 0) {
    return { status: "failed", error: "This submission has no evaluation results yet" };
  }

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

    // Best real name — resolved deterministically with the form's actual
    // question labels (submission data is keyed by field id).
    const applicantName = resolvePersonName({
      contactName: crmName,
      submitterName: row.submitter_name || "",
      submissionData: subData,
      fieldLabels: labels,
    });

    // Venture / project name when the form asked for one ("Startup Name") — the
    // result email names the project in its closing recommendation.
    const projectName = resolveProjectName({ submissionData: subData, fieldLabels: labels });

    // Workflow language from the form's question labels (FR forms get a
    // French document + email, EN forms an English one).
    const lang = detectLanguage(labels);

    // ── Answers: rebuild the form Q&A in section order ──
    let sectionsRows = [];
    let fieldRows = [];
    if (ctx?.form_id) {
      try {
        const sectionsResult = await getPlatformFormSections(ctx.form_id);
        sectionsRows = sectionsResult.rows || [];
        const fieldsResult = await getPlatformFormFields(ctx.form_id);
        fieldRows = fieldsResult.rows || [];
      } catch (_) {}
    }
    const isHidden = (field) => String(field.field_type || "") === "hidden";
    const getVal = (field) => subData[field.label] ?? subData[String(field.id)] ?? subData[field.id];

    const sections = [];
    const matchedKeys = new Set();
    for (const section of sectionsRows) {
      const items = [];
      for (const field of fieldRows) {
        if (String(field.section_id) !== String(section.id)) continue;
        if (isHidden(field)) continue;
        const value = formatResultAnswer(getVal(field));
        if (value === "") continue;
        matchedKeys.add(String(field.id));
        if (field.label) matchedKeys.add(field.label);
        items.push({ label: field.label || String(field.id), value });
      }
      if (items.length > 0) sections.push({ title: section.title, items });
    }

    // Fields without any section (older forms) → one flat group.
    const looseItems = [];
    for (const field of fieldRows) {
      if (sectionsRows.some((section) => String(section.id) === String(field.section_id))) continue;
      if (isHidden(field)) continue;
      const value = formatResultAnswer(getVal(field));
      if (value === "") continue;
      matchedKeys.add(String(field.id));
      if (field.label) matchedKeys.add(field.label);
      looseItems.push({ label: field.label || String(field.id), value });
    }
    if (looseItems.length > 0) sections.push({ title: null, items: looseItems });

    // Unmatched data keys (imported submissions may store answers under keys
    // that no longer map to a form field) — still part of the response.
    const unmatchedItems = Object.entries(subData)
      .filter(([key]) => !String(key).startsWith("_"))
      .filter(([key, value]) => !matchedKeys.has(String(key)) && formatResultAnswer(value) !== "")
      .map(([key, value]) => ({ label: key, value: formatResultAnswer(value) }));
    if (unmatchedItems.length > 0) sections.push({ title: null, items: unmatchedItems });

    // ── Evaluation: final dimension scores + feedback for the PDF ──
    // Weighted recompute mirrors the review page: human overrides (final_score)
    // are the source of truth when present.
    const totalWeight = rawDims.reduce((sum, dimension) => sum + (dimension.weight ?? 1), 0);
    const weighted = rawDims.reduce((sum, dimension) => sum + ((dimension.final_score ?? dimension.score ?? 0) * (dimension.weight ?? 1)), 0);
    const finalScore = rawDims.length > 0 && totalWeight > 0
      ? Math.round((weighted / totalWeight) * 10)
      : evalRow.overall_score;
    const dimensions = rawDims
      .map((dimension) => {
        const humanComment = typeof dimension.human_comment === "string" ? dimension.human_comment.trim() : "";
        const reasoning = typeof dimension.reasoning === "string" ? dimension.reasoning.trim() : "";
        return {
          name: dimension.name,
          score: dimension.final_score ?? dimension.score ?? null,
          feedback: humanComment || reasoning,
          strengths: Array.isArray(dimension.strengths) ? dimension.strengths.map((strength) => String(strength)) : [],
          improvements: Array.isArray(dimension.weaknesses) ? dimension.weaknesses.map((weakness) => String(weakness)) : [],
        };
      })
      .filter((dimension) => dimension.name);

    // ── Outcome: only when a real decision exists (approved/rejected/revision) ──
    let outcome = null;
    if (["approved", "rejected", "revision_requested"].includes(row.status)) {
      let comment = "";
      try {
        const reviewsResult = await getSubmissionReviewsBySubmissionId(submission_id);
        const latest = reviewsResult.rows[0];
        if (latest && typeof latest.comment === "string") comment = latest.comment;
      } catch (_) {}
      outcome = { decision: row.status, comment };
    }

    // ── The brief for the composed report ──
    // Two sources, either of which is enough on its own:
    //   • the run-specific Output Instruction, and/or
    //   • the document attached to this Run, already read into text at upload
    //     time (it may state every requirement the report needs).
    // Present → the report is written by AI from this same data, shaped by what
    // the administrator supplied, and stored so preview and send render the same
    // document. Neither → the fixed renderer, exactly as before.
    const outputInstruction = typeof ctx?.run_settings?.output_instruction === "string"
      ? ctx.run_settings.output_instruction.trim()
      : "";

    // Only a document that yielded TEXT can shape the report. An attachment that
    // could not be read (a scan) is simply not part of the brief — the screen says
    // so on its own; the report is never blocked by it.
    const reportFile = ctx?.run_id ? await getRunReportFileTextByRunId(ctx.run_id) : null;
    const referenceText = reportFile?.status === "ok" ? reportFile.text.trim() : "";

    let composedReport = null;
    if (outputInstruction || referenceText) {
      const { getOrCreateSubmissionReport } = await import("@/models/platform/ai/report");
      const composed = await getOrCreateSubmissionReport({
        submissionId: parseInt(submission_id),
        evaluationId: evalRow.id ?? null,
        decision: row.status || null,
        instruction: outputInstruction,
        reference: referenceText,
        referenceName: referenceText ? reportFile?.fileName || "" : "",
        lang,
        force: forceReport,
        payload: {
          runName: ctx?.run_name || "",
          formName: ctx?.form_name || "",
          applicantName: applicantName || "",
          submittedAt: row.submitted_at || row.updated_at || null,
          finalScore: finalScore != null ? Number(finalScore) : 0,
          ranking: evalRow.ranking || "",
          outcome,
          dimensions,
          sections,
        },
      });
      if (composed?.error || !composed?.report) {
        return {
          status: "failed",
          error: `This run asks for a composed report, but it could not be generated (${composed?.error || "empty result"})`,
        };
      }
      composedReport = composed.report;
      if (composed.generated) {
        logTimeline(parseInt(submission_id), "report_generated", "system", "System", { model: "deepseek-chat" });
      }
    }

    // ── Build the PDF document (nothing is sent from here) ──
    const { buildSubmissionResultPdf, buildComposedReportPdf } = await import("@/models/platform/resultPdf");
    const pdfBytes = composedReport
      ? buildComposedReportPdf({
          lang,
          applicantName: applicantName || "",
          submittedAt: row.submitted_at || row.updated_at || null,
          document: composedReport,
          // The instruction writes the READING; the platform appends the form's
          // questions and the participant's answers after it.
          sections,
        })
      : buildSubmissionResultPdf({
          lang,
          applicantName: applicantName || "",
          submittedAt: row.submitted_at || row.updated_at || null,
          finalScore: finalScore != null ? Number(finalScore) : 0,
          ranking: evalRow.ranking || "",
          outcome,
          dimensions,
          sections,
        });

    return {
      status: "ok",
      pdfBytes,
      lang,
      applicantName: applicantName || "",
      to: applicantEmail,
      row,
      score: finalScore != null ? Math.round(Number(finalScore)) : null,
      projectName,
      template: isFounderFitResultRun(ctx) ? "founder_fit" : "generic",
    };
  } catch (error) {
    console.error("[form-runs] Result document error:", error);
    return { status: "failed", error: error?.message || "Document error" };
  }
}

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

// A run screen re-reads often (navigation, refresh). The sweep is cheap when
// nothing is due, but building a report is not — so each run is swept at most
// once per window. The window is per server instance; a second instance simply
// sweeps its own turn, and the sentinel still prevents a double send.
const RESULT_SWEEP_COOLDOWN_MS = 2 * 60 * 1000;
const lastResultSweepAt = new Map();

/**
 * Ask for a sweep AFTER the current response has been written. Used on reads
 * (opening a run) and right after an approval, so a scheduled result never
 * waits on an external timer to exist — the timer only makes it punctual.
 */
export function scheduleResultSweep(runId = null) {
  const key = runId == null ? "*" : String(runId);
  const now = Date.now();
  if (now - (lastResultSweepAt.get(key) || 0) < RESULT_SWEEP_COOLDOWN_MS) return;
  lastResultSweepAt.set(key, now);
  after(() => dispatchScheduledResultEmails({ run_id: runId }).catch(() => {}));
}

/**
 * Shared approval/rejection workflow — used by BOTH the single review action
 * and the bulk review action so bulk approval is a controlled extension of
 * the individual flow, never a parallel implementation.
 *
 * Idempotency guard → review row (+ dimension overrides) → status update →
 * tracked decision email (Gmail, run→form→default template, resolved name) →
 * REVIEW_COMPLETED automation (activation/access emails, CRM identity) →
 * program auto-assignment.
 *
 * Returns { ok: true, submission, already_approved? } or
 *         { ok: false, statusCode, error }.
 */
export async function processReviewInternal({ submission_id, decision, comment, internal_note, dimension_overrides, force, session, includeResultPdf = false }) {
  // ── IDEMPOTENCY GUARD: never re-approve an already-approved submission ──
  // Manual override requires explicit force: true
  const existingSub = await getSubmissionReviewStateById(submission_id);
  if (existingSub.rows.length === 0) {
    return { ok: false, statusCode: 404, error: "Submission not found" };
  }
  const prevStatus = existingSub.rows[0].status;
  if (prevStatus === "approved" && decision === "approved" && !force) {
    return { ok: true, already_approved: true, submission: existingSub.rows[0] };
  }

  // ── "Also send the AI result PDF" is a promise the submission has to be able
  // to keep: that document IS the evaluation. Refuse the WHOLE action before any
  // side effect — no review row, no status change, no email — and say why, so
  // the reviewer evaluates the submission and approves again. An approval whose
  // requested document cannot follow is never half-sent. ──
  if (includeResultPdf && decision === "approved") {
    const evalGate = await getLatestEvaluationBySubmissionId(submission_id);
    const evalGateRow = evalGate.rows[0] || null;
    let gateDims = evalGateRow?.dimensions;
    if (typeof gateDims === "string") {
      try { gateDims = JSON.parse(gateDims); } catch (_) { gateDims = []; }
    }
    const hasResult = !!evalGateRow && (evalGateRow.overall_score != null || (Array.isArray(gateDims) && gateDims.length > 0));
    if (!hasResult) {
      return {
        ok: false,
        statusCode: 409,
        errorCode: "result_pdf_not_evaluated",
        error: "No AI result yet — this submission has not been evaluated. Run the evaluation first, then approve with the PDF.",
      };
    }
  }

  let reviewerName = session.cid;
  try {
    const reviewerResult = await getReviewerNameByCid(session.cid);
    if (reviewerResult.rows.length) reviewerName = reviewerResult.rows[0].name;
  } catch (_) {}

  // Save review with dimension overrides if provided
  await createSubmissionReview({
    submissionId: submission_id,
    reviewerId: session.cid,
    reviewerName,
    decision,
    comment,
    internalNote: internal_note,
  });

  // Store dimension overrides in separate evaluation update
  if (dimension_overrides && Array.isArray(dimension_overrides) && dimension_overrides.length > 0) {
    try {
      const evaluationResult = await getLatestEvaluationForOverridesBySubmissionId(submission_id);
      if (evaluationResult.rows.length > 0) {
        const existing = evaluationResult.rows[0];
        const dims = existing.dimensions || [];
        const updatedDims = dims.map(dimension => {
          const override = dimension_overrides.find(overrideCandidate => overrideCandidate.name === dimension.name);
          if (override) {
            return { ...dimension, human_score: override.human_score, human_comment: override.human_comment || "", final_score: override.final_score };
          }
          return dimension;
        });
        await updateEvaluationDimensionsById(existing.id, updatedDims);
      }
    } catch (_) {}
  }

  // Update submission status — map workflow decision to core platform state
  const CORE_STATES = ["approved", "rejected", "revision_requested", "submitted", "draft"];
  const newStatus = CORE_STATES.includes(decision) ? decision : "approved";
  const result = await updateSubmissionStatusById(submission_id, newStatus);

  logTimeline(parseInt(submission_id), decision, session.cid, reviewerName, { comment, internal_note });

  // Send decision email to applicant — TRACKED (never sent twice)
  await sendDecisionEmailForSubmission({ submission_id, decision, comment: comment || "" });

  // The reviewer also asked for the AI result document. It goes out as its OWN
  // email — its own type, its own guard in the Emails tab — through the exact
  // path behind "Send Response", so the document is identical whether it is
  // sent from the approval checkbox or by hand. The gate above guarantees an
  // evaluation exists, so this never sends an empty document.
  let resultPdf = null;
  if (includeResultPdf && decision === "approved") {
    try {
      resultPdf = await sendResultEmailForSubmission({ submission_id });
    } catch (error) {
      resultPdf = { status: "failed", error: error?.message || "Result PDF failed" };
    }
  }

  // Fire automation — get run details + form config for context
  const submissionRunResult = await getSubmissionRunIdById(submission_id);
  if (submissionRunResult.rows.length > 0) {
    const runData = await getRunDataForReviewAutomationById(submissionRunResult.rows[0].run_id);
    let formData = null;
    if (runData.rows[0]) {
      const formResult = await getFormById(runData.rows[0].form_id);
      formData = formResult.rows[0] || null;
    }

    // Record a PENDING activation email BEFORE firing the background task.
    // If the serverless function is terminated before `after()` completes,
    // this pending row remains visible in the Emails tab as retryable.
    if (decision === "approved") {
      try {
        const { recordEmailStatus } = await import("@/lib/email");
        await recordEmailStatus({
          submission_id: parseInt(submission_id),
          contact_cid: result.rows[0]?.submitter_id || null,
          email_type: "activation",
          status: "pending",
          error: "Queued — waiting for background automation",
          to: result.rows[0]?.submitter_id || null,
        });
      } catch (_) {}
    }

    after(() => {
      onReview(
        { id: null, submission_id: parseInt(submission_id), decision, comment, reviewer_name: reviewerName },
        result.rows[0],
        runData.rows[0] || null,
        session,
        formData
      ).catch((err) => {
        console.error("[form-runs] Background automation failed:", err.message);
      });
    });

    // Synchronous program/group sync (does NOT rely on background automation).
    if (decision === "approved" && runData.rows[0]) {
      await syncApprovedSubmissionToProgramGroup(result.rows[0]);
    }

    // A result whose scheduled time has already passed goes out as soon as the
    // reviewer decides — no need to reopen the run for it to be picked up.
    // The sweep honours the run's delay and is idempotent, so it is safe to ask
    // on every decision (a delay of 0 asks for nothing).
    if (decision === "approved") {
      scheduleResultSweep(submissionRunResult.rows[0].run_id);
    }
  }

  return { ok: true, submission: result.rows[0], result_pdf: resultPdf };
}

/* ───────────────────────────────────────────────────────────────────────────
 * Slice 2 — the remaining POST actions that carry a real decision (not just
 * "validate params, call one model function, shape the response", which stays
 * legitimate controller work in route.js). Each takes plain data (never `req`
 * or `NextResponse`) and returns a plain result the controller shapes into
 * JSON — same convention as processReviewInternal above.
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * SUBMIT ACTION — gate (active/not-closed/limit) → score → save → automation.
 * Verbatim from the controller's `action === "submit"` block, only the HTTP
 * envelope (session/auth check, response shaping) is left to the caller.
 */
export async function submitResponse({ run_id, data, status: subStatus, session }) {
  if (!run_id) return { ok: false, statusCode: 400, error: "run_id is required" };

  // Check run is active and not closed
  const run = await getRunSubmissionGateById(run_id);
  if (run.rows.length === 0) return { ok: false, statusCode: 404, error: "Run not found" };
  if (run.rows[0].status !== "active") return { ok: false, statusCode: 400, error: "Run is not active" };
  const gateSettings = run.rows[0].settings || {};
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
      const { formHasAiEvaluation } = await import("@/lib/platform/ai/evaluate");
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
      if (formAiEnabled) {
        const newSubmissionId = result.rows[0].id;
        try {
          const { submissionHasEvaluation, evaluateSubmission } = await import("@/lib/platform/ai/evaluate");
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
  } else {
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
      if (formAiEnabled) {
        const newSubmissionId = result.rows[0].id;
        try {
          const { evaluateSubmission } = await import("@/lib/platform/ai/evaluate");
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
}

/**
 * MANUAL ADD ACTION (super admin injects a respondent) — verbatim from the
 * controller. Defaults the submission to "approved" so the person is
 * immediately eligible for an activation/join email; pass status explicitly
 * to exercise the full scoring/review flow when testing.
 */
export async function manualAddSubmission({ run_id, name, email, data, status: subStatus, session }) {
  if (!run_id) return { ok: false, statusCode: 400, error: "run_id is required" };

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
      const { formHasAiEvaluation } = await import("@/lib/platform/ai/evaluate");
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
    if (formAiEnabled) {
      const newSubmissionId = result.rows[0].id;
      try {
        const { evaluateSubmission } = await import("@/lib/platform/ai/evaluate");
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

/**
 * ASSIGN ACTION — verbatim from the controller. Accepts either the legacy
 * single target or a list of targets so one call can assign a run to several
 * audiences at once.
 */
export async function assignRunTargets({ run_id, target_type, target_id, targets, session }) {
  const ALLOWED_TARGET_TYPES = ["user", "group", "program", "cohort", "team", "organization", "all"];
  const targetList = Array.isArray(targets)
    ? targets
    : [{ target_type: target_type || "user", target_id }];
  const valid = targetList.filter(
    (target) => target && ALLOWED_TARGET_TYPES.includes(target.target_type) && target.target_id,
  );
  if (!run_id || valid.length === 0) {
    return { ok: false, statusCode: 400, error: "run_id and target required" };
  }

  const runId = parseInt(run_id);
  let added = 0;
  let skipped = 0;
  const createdTargets = [];
  for (const target of valid) {
    const insertResult = await insertRunAssignmentForAction({
      runId,
      targetType: target.target_type,
      targetId: target.target_id,
      assignedBy: session.cid,
    });
    if (insertResult.rowsAffected > 0) {
      added++;
      createdTargets.push({ target_type: target.target_type, target_id: target.target_id });
    } else {
      skipped++;
    }
  }

  const assignments = await getAssignmentsAfterAssignByRunId(runId);
  // Fire automation for each newly created assignment
  const fullRun = await getFullRunAfterAssignById(runId);
  for (const target of createdTargets) {
    onAssignmentAdded(target, fullRun.rows[0] || { id: runId });
  }
  return { ok: true, added, skipped, assignments: await enrichAssignments(assignments.rows) };
}

/** UNASSIGN ACTION — verbatim from the controller. */
export async function unassignRunTarget({ assignment_id }) {
  if (!assignment_id) return { ok: false, statusCode: 400, error: "assignment_id required" };

  const assignmentResult = await getRunIdByAssignmentId(assignment_id);
  const runId = assignmentResult.rows[0]?.run_id;

  await deleteAssignmentById(assignment_id);

  if (runId) {
    const assignments = await getAssignmentsAfterUnassignByRunId(runId);
    return { ok: true, assignments: await enrichAssignments(assignments.rows) };
  }
  return { ok: true, assignments: [] };
}

/**
 * BULK REVIEW ACTION — verbatim from the controller. A controlled extension
 * of the individual review workflow: each selected respondent goes through
 * processReviewInternal (status, approval email, activation/access
 * automation, idempotency) — no parallel logic.
 */
export async function bulkReviewSubmissions({ run_id, submission_ids, decision, comment, include_result_pdf, session }) {
  if (!run_id || !Array.isArray(submission_ids) || submission_ids.length === 0) {
    return { ok: false, statusCode: 400, error: "run_id and submission_ids are required" };
  }
  if (submission_ids.length > 25) {
    return { ok: false, statusCode: 400, error: "A bulk batch can process at most 25 submissions" };
  }
  if (decision !== "approved") {
    return { ok: false, statusCode: 400, error: "Only 'approved' is supported as a bulk action right now" };
  }

  const idList = [...new Set(submission_ids.map((id) => parseInt(id)).filter((numericId) => Number.isFinite(numericId)))];
  if (idList.length === 0) {
    return { ok: false, statusCode: 400, error: "No valid submission ids provided" };
  }

  // Backend validation: every id must belong to THIS run — the frontend
  // selection state is never trusted alone.
  const validationsResult = await getBulkReviewValidationsByIdsInRun(idList, run_id);
  const validMap = new Map(validationsResult.rows.map((row) => [row.id, row]));

  const results = [];
  for (const id of idList) {
    const row = validMap.get(id);
    if (!row) {
      results.push({ submission_id: id, status: "failed", name: "", error: "Submission is not in this run" });
      continue;
    }
    if (row.status === "approved") {
      results.push({ submission_id: id, status: "already_approved", name: row.submitter_name || "" });
      continue;
    }
    try {
      const reviewResult = await processReviewInternal({
        submission_id: id,
        decision: "approved",
        comment: comment || "Bulk approved",
        session,
        includeResultPdf: include_result_pdf === true,
      });
      results.push({
        submission_id: id,
        status: reviewResult.ok ? (reviewResult.already_approved ? "already_approved" : "approved") : "failed",
        name: row.submitter_name || "",
        error: reviewResult.ok ? undefined : reviewResult.error,
        result_pdf: reviewResult.result_pdf ? reviewResult.result_pdf.status : undefined,
        result_pdf_error: reviewResult.result_pdf ? reviewResult.result_pdf.error : undefined,
      });
    } catch (error) {
      results.push({
        submission_id: id,
        status: "failed",
        name: row.submitter_name || "",
        error: error?.message || "Unknown error",
      });
    }
  }

  return { ok: true, results };
}

/**
 * RETRY FAILED EMAILS ACTION — verbatim from the controller. Manual retry
 * only. Each selected (submission, email_type) pair must have a FAILED send;
 * succeeded sends are never resent.
 */
export async function retryFailedEmails({ run_id, retries, session }) {
  if (!run_id || !Array.isArray(retries) || retries.length === 0) {
    return { ok: false, statusCode: 400, error: "run_id and retries are required" };
  }

  if (!retries.every((retry) => retry && Number.isFinite(parseInt(retry.submission_id)) && typeof retry.email_type === "string")) {
    return { ok: false, statusCode: 400, error: "Each retry needs submission_id and email_type" };
  }

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

  return { ok: true, results };
}

/**
 * MARK EMAILS CANCELLED ACTION (admin stopped a batch before sending) —
 * verbatim from the controller. Appends a 'cancelled' row for pairs that were
 * NOT attempted; already-sent pairs are never touched.
 */
export async function markEmailsCancelled({ run_id, items }) {
  if (!run_id || !Array.isArray(items) || items.length === 0) {
    return { ok: false, statusCode: 400, error: "run_id and items are required" };
  }
  if (items.length > 100) {
    return { ok: false, statusCode: 400, error: "A cancel batch can process at most 100 items" };
  }

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
  return { ok: true, marked };
}

/**
 * SEND MANUAL MESSAGE ACTION (Room Overview → selected participants) —
 * verbatim from the controller.
 */
export async function sendManualMessageToSubmissions({ run_id, submission_ids, subject, body: messageBody }) {
  if (!run_id || !Array.isArray(submission_ids) || submission_ids.length === 0) {
    return { ok: false, statusCode: 400, error: "run_id and submission_ids are required" };
  }
  if (!subject || !messageBody) {
    return { ok: false, statusCode: 400, error: "subject and body are required" };
  }
  if (submission_ids.length > 500) {
    return { ok: false, statusCode: 400, error: "A manual message can send to at most 500 recipients" };
  }

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

  const { sendManualMessage, resolveSubmissionEmail: resolveEmail, resolvePersonName: resolveName, isPlaceholderEmail } = await import("@/lib/email");

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
    const contactEmail = resolveEmail({ submissionData: subData, fieldLabels, contactEmail: "" });
    if (!contactEmail || isPlaceholderEmail(contactEmail)) {
      results.push({ submission_id: id, name: submission.submitter_name || "", status: "failed", error: "No usable recipient email" });
      failed++;
      continue;
    }

    const name = resolveName({
      contactName: "",
      submitterName: submission.submitter_name || "",
      submissionData: subData,
      fieldLabels,
    }) || submission.submitter_name || "Participant";

    const sendResult = await sendManualMessage({
      to: contactEmail,
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

  return { ok: true, batch_id: batchId, recipients: idList.length, sent, failed, results };
}

/**
 * SEND ACTIVATION MESSAGES ACTION (Run Overview → selected approved) —
 * verbatim from the controller.
 */
export async function sendActivationMessagesToSubmissions({ run_id, submission_ids, force, session }) {
  if (!run_id || !Array.isArray(submission_ids) || submission_ids.length === 0) {
    return { ok: false, statusCode: 400, error: "run_id and submission_ids are required" };
  }
  const forceResend = force === true || force === 1 || force === "true" || force === "1";

  // Backend validation: every submission must belong to THIS run.
  const idList = [...new Set(submission_ids.map((id) => parseInt(id)))];
  const validationsResult = await getActivationMessageSubmissionsByIdsInRun(idList, run_id);
  const validMap = new Map(validationsResult.rows.map((row) => [row.id, row]));

  const { getEmailLogRow: getLog, getActivationHistory } = await import("@/lib/email");
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

    const logRow = await getLog(id, "activation");
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
      const after = await getLog(id, "activation");
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

  return { ok: true, results };
}
