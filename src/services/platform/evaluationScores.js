/**
 * Platform — the run-scoped evaluation scoreboard (SERVICE layer).
 *
 * The domain work behind GET `/api/platform/ai/evaluation-scores`: the run → form
 * resolution (the run is the source of truth), the score-boundary filter, the
 * dynamic filterable-field derivation and the respondent shaping (answers keyed
 * by the form's OWN question labels, real name/email resolution).
 *
 * The CONTROLLER keeps `initDb`, the `runs.view` capability and the envelope.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**` and `@/lib/**`.
 */

import { resolvePersonName, resolveSubmissionEmail } from "@/lib/email";
import {
  countEvaluatedSubmissionsForScores,
  countQualifyingEvaluationsForScores,
  getAverageQualifyingScoreForScores,
  getContactEmailsByCids,
  getFormFieldsForScores,
  getRunInfoForScores,
  listScoreRespondents,
} from "@/models/platformAi";

function normalizeOptions(raw) {
  if (!raw) return [];
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch (_) {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((option) => (typeof option === "string" ? option : option?.label || option?.value || String(option)))
    .filter((option) => option != null && String(option).trim() !== "");
}

function answerValue(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") {
    try {
      if (value.startsWith("{") && value.includes('"code"')) {
        const parsedCode = JSON.parse(value);
        if (parsedCode.code != null) return `${parsedCode.code} ${parsedCode.number || ""}`.trim();
      }
    } catch (_) {}
    return value;
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * RUN-SCOPED scoreboard: evaluations for a specific Run. The run determines its
 * form (server-side source of truth), and all counts, averages, answers and
 * filterable fields derive from that run's actual submissions — never from
 * another form or another run.
 *
 * @returns {Promise<{status: number, body: Object}>}
 */
export async function getEvaluationScoreboard({ runIdParam, formIdParam, minScore, maxScore, sort }) {
  // ── Run → Form resolution (the run is the source of truth) ──
  let effectiveFormId = formIdParam ? parseInt(formIdParam) : null;
  let runInfo = null;
  const conditions = [];
  const args = [];

  if (runIdParam) {
    const runRes = await getRunInfoForScores(runIdParam);
    if (runRes.rows.length === 0) {
      return { status: 404, body: { success: false, error: "Run not found" } };
    }
    runInfo = runRes.rows[0];
    effectiveFormId = runInfo.form_id;
    conditions.push("s.run_id = ?");
    args.push(parseInt(runIdParam));
  }

  if (effectiveFormId == null) {
    return { status: 400, body: { success: false, error: "run_id or form_id is required" } };
  }

  conditions.push("r.form_id = ?");
  args.push(effectiveFormId);

  // ── The form's actual fields — the dynamic filter source ──
  const fieldsRes = await getFormFieldsForScores(effectiveFormId);
  const labelById = {};
  const filterableFields = [];
  for (const field of fieldsRes.rows) {
    labelById[String(field.id)] = field.label;
    const options = normalizeOptions(field.options);
    if (options.length > 0) filterableFields.push({ label: field.label, options: options });
  }

  // Score boundaries apply on top of the run/form scope
  const qualifyingConditions = [...conditions];
  const qualifyingArgs = [...args];
  if (minScore !== null && minScore !== "" && !isNaN(parseFloat(minScore))) {
    qualifyingConditions.push("e.overall_score >= ?");
    qualifyingArgs.push(parseFloat(minScore));
  }
  if (maxScore !== null && maxScore !== "" && !isNaN(parseFloat(maxScore))) {
    qualifyingConditions.push("e.overall_score <= ?");
    qualifyingArgs.push(parseFloat(maxScore));
  }

  const whereAll = conditions.join(" AND ");
  const whereQualifying = qualifyingConditions.join(" AND ");

  // Total evaluated in scope
  const totalRes = await countEvaluatedSubmissionsForScores(whereAll, args);
  const totalEvaluated = totalRes.rows[0]?.cnt || 0;

  // Qualifying count
  const qualifyingRes = await countQualifyingEvaluationsForScores(whereQualifying, qualifyingArgs);
  const qualifyingCount = qualifyingRes.rows[0]?.cnt || 0;

  // Average score of qualifying
  const avgRes = await getAverageQualifyingScoreForScores(whereQualifying, qualifyingArgs);
  const averageScore = Math.round((avgRes.rows[0]?.avg || 0) * 10) / 10;

  // Respondents (include submission data for dynamic answers + search)
  const sortDir = sort === "asc" ? "ASC" : "DESC";
  const respondentsRes = await listScoreRespondents(whereQualifying, qualifyingArgs, sortDir);

  // Batch-load contact emails (single query instead of one per respondent)
  const cids = [...new Set(respondentsRes.rows.map((respondent) => respondent.submitter_id).filter(Boolean))];
  const emailMap = new Map();
  if (cids.length > 0) {
    try {
      const contactEmailsResult = await getContactEmailsByCids(cids);
      for (const row of contactEmailsResult.rows) emailMap.set(row.cid, row.email || "");
    } catch (_) {}
  }

  const rankings = new Set();
  const respondents = respondentsRes.rows.map((respondent) => {
    // Answers keyed by field LABEL (never hardcoded — derived from the form)
    const answers = {};
    const subData = respondent.submission_data || {};
    for (const [key, value] of Object.entries(subData)) {
      if (key.startsWith("_")) continue;
      const label = labelById[String(key)] || key;
      answers[label] = answerValue(value);
    }

    // Real applicant email: the form's actual email answer first, then any real
    // email in the submission, then the CRM email. Placeholder import addresses
    // are never returned.
    const email = resolveSubmissionEmail({
      submissionData: subData,
      fieldLabels: labelById,
      contactEmail: emailMap.get(respondent.submitter_id) || "",
    });

    if (respondent.ranking) rankings.add(respondent.ranking);

    return {
      // Best real name — resolved deterministically with the form's actual
      // question labels; never "Unknown" when a real name exists.
      name:
        resolvePersonName({
          contactName: "",
          submitterName: respondent.name || "",
          submissionData: subData,
          fieldLabels: labelById,
        }) || respondent.name || "Unknown",
      email,
      score: respondent.score,
      ranking: respondent.ranking || "",
      recommendation: respondent.recommendation || "",
      submission_id: respondent.submission_id,
      status: respondent.submission_status || "submitted",
      answers,
    };
  });

  return {
    status: 200,
    body: {
      success: true,
      run: runInfo ? { id: runInfo.id, name: runInfo.name } : null,
      total_evaluated: totalEvaluated,
      qualifying_count: qualifyingCount,
      average_score: averageScore,
      threshold: {
        min: minScore ? parseFloat(minScore) : null,
        max: maxScore ? parseFloat(maxScore) : null,
      },
      respondents,
      filterable_fields: filterableFields,
      rankings: [...rankings].sort(),
    },
  };
}
