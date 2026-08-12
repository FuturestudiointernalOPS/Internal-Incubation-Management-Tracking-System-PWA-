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
 *   total_evaluated   — count of all evaluated submissions for this form
 *   qualifying_count   — count after applying min/max filters
 *   average_score      — average overall_score of qualifying
 *   threshold          — the min/max boundary used for qualifying
 *   respondents[]      — array of { name, email, score, ranking, recommendation, submission_id }
 */

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

    // Respondents
    const sortDir = sort === "asc" ? "ASC" : "DESC";
    const respondentsRes = await db.execute({
      sql: `SELECT
              s.submitter_name AS name,
              e.overall_score AS score,
              e.ranking,
              e.recommendation,
              e.submission_id,
              s.id AS submission_id_ext
            FROM platform_submission_evaluations e
            JOIN platform_form_submissions s ON e.submission_id = s.id
            JOIN platform_form_runs r ON s.run_id = r.id
            WHERE ${whereQualifying}
            ORDER BY e.overall_score ${sortDir}`,
      args,
    });

    // Enrich with email from contacts
    const respondents = await Promise.all(
      respondentsRes.rows.map(async (r) => {
        let email = "";
        try {
          const nameKey = r.name;
          if (nameKey) {
            const contactRes = await db.execute({
              sql: "SELECT email FROM contacts WHERE name ILIKE ? LIMIT 1",
              args: [`%${nameKey}%`],
            });
            if (contactRes.rows.length > 0) {
              email = contactRes.rows[0].email || "";
            }
          }
        } catch (_) {}

        return {
          name: r.name || "Unknown",
          email,
          score: r.score,
          ranking: r.ranking || "",
          recommendation: r.recommendation || "",
          submission_id: r.submission_id || r.submission_id_ext,
        };
      })
    );

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
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
