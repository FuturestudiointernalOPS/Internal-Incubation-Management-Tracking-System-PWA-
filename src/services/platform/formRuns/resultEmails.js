/**
 * Platform — form runs: the decision/result email and document cluster (SERVICE layer).
 *
 * The workflow emails one Run sends to its respondents: the tracked decision
 * (approval/rejection) email, the participant-facing RESULT document and email
 * (answers, evaluation feedback, final score; the composed-report path when the
 * run carries an Output Instruction or an attached reference document) and the
 * scheduled dispatcher that delivers results once each run's own delay has
 * elapsed. `logTimeline` is the shared fire-and-forget audit entry.
 *
 * Split of `services/platform/formRuns.js` (see docs/LAYER_SPLIT.md): this is the
 * `resultEmails` slice; the barrel at the original path re-exports the same
 * surface. The review, respondent and action slices import `logTimeline` and the
 * two senders from here.
 *
 * Layer: decisions and shaping, no SQL, no HTTP. It reads through `@/models/**`
 * and `@/lib/**`; the PDF renderer and the composed-report builder are imported
 * lazily at their call sites.
 */

import {
  detectLanguage,
  ensureEmailLogTable,
  getDesignedTemplate,
  getEmailLogRow,
  getTemplate,
  hasSentEmailToRecipientInRun,
  recordEmailStatus,
  resolvePersonName,
  resolveProjectName,
  resolveResultDelayMinutes,
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
  getLatestEvaluationBySubmissionId,
  getLatestScoreBySubmissionId,
  getRunFormContextBySubmissionId,
  getRunTemplateSettingsForDecisionById,
  getSubmissionReviewsBySubmissionId,
  insertTimelineEntry,
  listApprovedSubmissionsAwaitingResultEmail,
} from "@/models/formRuns";
import { getPlatformFormFields, getPlatformFormSections } from "@/models/forms";
import { getRunReportFileTextByRunId } from "@/models/platform/reportFiles";

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

/** Render one submission answer value for the result PDF (phone JSON → text). */
function formatResultAnswer(value) {
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
function isFounderFitResultRun(ctx) {
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
      const { getOrCreateSubmissionReport } = await import("@/services/platform/report");
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
