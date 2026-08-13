import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/platform/ai/evaluation-scores
 *
 * Query params:
 *   form_id                 (required) — filter evaluations to submissions in runs of this form
 *   min_score               (optional) — minimum overall_score filter
 *   max_score               (optional) — maximum overall_score filter
 *   sort                    (optional) — "asc" or "desc", default "desc"
 *
 * Returns:
 *   total_evaluated     — count of all evaluated submissions for this form
 *   qualifying_count    — count after applying min/max filters
 *   average_score       — average overall_score of qualifying
 *   threshold           — the min/max boundary used for qualifying
 *   respondents[]       — { name, email, score, ranking, recommendation,
 *                          submission_id, status, answers }
 *   filterable_fields[] — the form's actual fields that carry answer options
 *                         (dynamic source for the dashboard's column filters)
 *   rankings[]          — distinct evaluation rankings present in the data
 *
 * `answers` maps each form field's label to the respondent's stored value,
 * so the dashboard can search and filter against the real dataset without
 * any hardcoded columns.
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
    .map((o) => (typeof o === "string" ? o : o?.label || o?.value || String(o)))
    .filter((s) => s != null && String(s).trim() !== "");
}

function answerValue(v) {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") {
    try {
      if (v.startsWith("{") && v.includes('"code"')) {
        const p = JSON.parse(v);
        if (p.code != null) return `${p.code} ${p.number || ""}`.trim();
      }
    } catch (_) {}
    return v;
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "admin", "program_manager", "teacher"]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const formId = searchParams.get("form_id");
    const minScore = searchParams.get("min_score");
    const maxScore = searchParams.get("max_score");
    const sort = searchParams.get("sort") || "desc";

    if (!formId) {
      return NextResponse.json(
        { success: false, error: "form_id is required" },
        { status: 400 }
      );
    }

    // ── The form's actual fields — the dynamic filter source ──
    const fieldsRes = await db.execute({
      sql: "SELECT id, label, field_type, options FROM platform_form_fields WHERE form_id::text = ? ORDER BY sort_order, id",
      args: [String(formId)],
    });
    const labelById = {};
    const filterableFields = [];
    for (const f of fieldsRes.rows) {
      labelById[String(f.id)] = f.label;
      const opts = normalizeOptions(f.options);
      if (opts.length > 0) filterableFields.push({ label: f.label, options: opts });
    }

    // Build conditions
    const conditions = [];
    const args = [parseInt(formId)];

    conditions.push("r.form_id = ?");

    let qualifyingConditions = [...conditions];

    if (minScore !== null && minScore !== "" && !isNaN(parseFloat(minScore))) {
      qualifyingConditions.push("e.overall_score >= ?");
      args.push(parseFloat(minScore));
    }
    if (maxScore !== null && maxScore !== "" && !isNaN(parseFloat(maxScore))) {
      qualifyingConditions.push("e.overall_score <= ?");
      args.push(parseFloat(maxScore));
    }

    const whereAll = conditions.join(" AND ");
    const whereQualifying = qualifyingConditions.join(" AND ");

    // Total evaluated (all for this form, regardless of score filter)
    const totalRes = await db.execute({
      sql: `SELECT COUNT(*)::int AS cnt
            FROM platform_submission_evaluations e
            JOIN platform_form_submissions s ON e.submission_id = s.id
            JOIN platform_form_runs r ON s.run_id = r.id
            WHERE ${whereAll}`,
      args: [parseInt(formId)],
    });
    const totalEvaluated = totalRes.rows[0]?.cnt || 0;

    // Qualifying count
    const qualifyingRes = await db.execute({
      sql: `SELECT COUNT(*)::int AS cnt
            FROM platform_submission_evaluations e
            JOIN platform_form_submissions s ON e.submission_id = s.id
            JOIN platform_form_runs r ON s.run_id = r.id
            WHERE ${whereQualifying}`,
      args,
    });
    const qualifyingCount = qualifyingRes.rows[0]?.cnt || 0;

    // Average score of qualifying
    const avgRes = await db.execute({
      sql: `SELECT COALESCE(AVG(e.overall_score), 0)::float AS avg
            FROM platform_submission_evaluations e
            JOIN platform_form_submissions s ON e.submission_id = s.id
            JOIN platform_form_runs r ON s.run_id = r.id
            WHERE ${whereQualifying}`,
      args,
    });
    const averageScore = Math.round((avgRes.rows[0]?.avg || 0) * 10) / 10;

    // Respondents (include submission data for dynamic answers + search)
    const sortDir = sort === "asc" ? "ASC" : "DESC";
    const respondentsRes = await db.execute({
      sql: `SELECT
              s.submitter_name AS name,
              s.submitter_id,
              s.status AS submission_status,
              s.data AS submission_data,
              e.overall_score AS score,
              e.ranking,
              e.recommendation,
              e.submission_id
            FROM platform_submission_evaluations e
            JOIN platform_form_submissions s ON e.submission_id = s.id
            JOIN platform_form_runs r ON s.run_id = r.id
            WHERE ${whereQualifying}
            ORDER BY e.overall_score ${sortDir}`,
      args,
    });

    // Batch-load contact emails (single query instead of one per respondent)
    const cids = [...new Set(respondentsRes.rows.map((r) => r.submitter_id).filter(Boolean))];
    const emailMap = new Map();
    if (cids.length > 0) {
      try {
        const cres = await db.execute({
          sql: "SELECT cid, email FROM contacts WHERE cid = ANY(?)",
          args: [cids],
        });
        for (const row of cres.rows) emailMap.set(row.cid, row.email || "");
      } catch (_) {}
    }

    const rankings = new Set();
    const respondents = respondentsRes.rows.map((r) => {
      // Answers keyed by field LABEL (never hardcoded — derived from the form)
      const answers = {};
      const subData = r.submission_data || {};
      for (const [key, value] of Object.entries(subData)) {
        if (key.startsWith("_")) continue;
        const label = labelById[String(key)] || key;
        answers[label] = answerValue(value);
      }

      // Email meant to receive notifications: contact email first,
      // fall back to any email-looking value inside the submission data.
      let email = emailMap.get(r.submitter_id) || "";
      if (!email) {
        const found = Object.values(subData).find(
          (v) => typeof v === "string" && v.includes("@")
        );
        if (found) email = found;
      }

      if (r.ranking) rankings.add(r.ranking);

      return {
        name: r.name || "Unknown",
        email,
        score: r.score,
        ranking: r.ranking || "",
        recommendation: r.recommendation || "",
        submission_id: r.submission_id,
        status: r.submission_status || "submitted",
        answers,
      };
    });

    return NextResponse.json({
      success: true,
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
