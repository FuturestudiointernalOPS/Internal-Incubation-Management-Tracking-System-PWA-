import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
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

/**
 * GET /api/platform/ai/evaluation-scores
 *
 * RUN-SCOPED: evaluations are returned for a specific Run. The run
 * determines its form (server-side source of truth), and all counts,
 * averages, answers and filterable fields derive from that run's actual
 * submissions — never from another form or another run.
 *
 * Query params:
 *   run_id                  (preferred) — scope to one run
 *   form_id                 (fallback)  — scope to all runs of one form
 *   min_score               (optional) — minimum overall_score filter
 *   max_score               (optional) — maximum overall_score filter
 *   sort                    (optional) — "asc" or "desc", default "desc"
 *
 * Returns:
 *   run                  — { id, name } when run-scoped
 *   total_evaluated      — evaluated submissions in scope
 *   qualifying_count     — count after min/max filters
 *   average_score        — average overall_score of qualifying
 *   threshold            — min/max boundary used
 *   respondents[]        — { name, email, score, ranking, recommendation,
 *                           submission_id, status, answers }
 *   filterable_fields[]  — the form's actual fields that carry answer options
 *   rankings[]           — distinct evaluation rankings present in the data
 */

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

export async function GET(req) {
  try {
    await initDb();
    // The scoreboard is a read of one Run's evaluations and the respondent PII
    // behind them, so it is gated on the `runs.view` capability. It used to be
    // a ["super_admin", "admin", "program_manager"] role list, which no
    // capability grant could ever satisfy (and which names the retired `admin`
    // role). Configure it under Default Access -> Runs -> View, or grant it to
    // one person.
    const capError = await requireAuthorization("runs", "view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const runIdParam = searchParams.get("run_id");
    const formIdParam = searchParams.get("form_id");
    const minScore = searchParams.get("min_score");
    const maxScore = searchParams.get("max_score");
    const sort = searchParams.get("sort") || "desc";

    // ── Run → Form resolution (the run is the source of truth) ──
    let effectiveFormId = formIdParam ? parseInt(formIdParam) : null;
    let runInfo = null;
    const conditions = [];
    const args = [];

    if (runIdParam) {
      const runRes = await getRunInfoForScores(runIdParam);
      if (runRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: "Run not found" }, { status: 404 });
      }
      runInfo = runRes.rows[0];
      effectiveFormId = runInfo.form_id;
      conditions.push("s.run_id = ?");
      args.push(parseInt(runIdParam));
    }

    if (effectiveFormId == null) {
      return NextResponse.json(
        { success: false, error: "run_id or form_id is required" },
        { status: 400 }
      );
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
    let qualifyingConditions = [...conditions];
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

      // Real applicant email: the form's actual email answer first, then any
      // real email in the submission, then the CRM email. Placeholder import
      // addresses are never returned.
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

    return NextResponse.json({
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
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
