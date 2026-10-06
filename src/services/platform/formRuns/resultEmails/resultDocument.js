/**
 * Platform — form runs: the participant-facing RESULT document (SERVICE layer).
 *
 * The answer/evaluation/score document builder shared by the sender and the
 * read-only preview. Split verbatim out of
 * `services/platform/formRuns/resultEmails.js` — see docs/LAYER_SPLIT.md.
 *
 * Layer: decisions and shaping, no SQL, no HTTP. The PDF renderer and the
 * composed-report builder are imported lazily at their call sites.
 */

import {
  detectLanguage,
  resolvePersonName,
  resolveProjectName,
  resolveSubmissionEmail,
} from "@/lib/email";
import {
  getContactNameEmailByCid,
  getDecisionEmailSubmissionById,
  getFieldLabelsByRunId,
  getLatestEvaluationBySubmissionId,
  getRunFormContextBySubmissionId,
  getSubmissionReviewsBySubmissionId,
} from "@/models/formRuns";
import { getPlatformFormFields, getPlatformFormSections } from "@/models/forms";
import { getRunReportFileTextByRunId } from "@/models/platform/reportFiles";

import { logTimeline } from "./decisionEmail";

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
