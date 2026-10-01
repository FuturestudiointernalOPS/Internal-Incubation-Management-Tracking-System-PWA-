import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
import { getEvaluationScoreboard } from "@/services/platform/evaluationScores";

/**
 * GET /api/platform/ai/evaluation-scores
 *
 * RUN-SCOPED: evaluations are returned for a specific Run. The run determines
 * its form (server-side source of truth), and all counts, averages, answers and
 * filterable fields derive from that run's actual submissions — never from
 * another form or another run.
 *
 * Query params:
 *   run_id                  (preferred) — scope to one run
 *   form_id                 (fallback)  — scope to all runs of one form
 *   min_score               (optional) — minimum overall_score filter
 *   max_score               (optional) — maximum overall_score filter
 *   sort                    (optional) — "asc" or "desc", default "desc"
 *
 * Thin controller: gates on `runs.view` and delegates to
 * `@/services/platform/evaluationScores` (see docs/LAYER_SPLIT.md).
 */

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
    const { status, body } = await getEvaluationScoreboard({
      runIdParam: searchParams.get("run_id"),
      formIdParam: searchParams.get("form_id"),
      minScore: searchParams.get("min_score"),
      maxScore: searchParams.get("max_score"),
      sort: searchParams.get("sort") || "desc",
    });
    return NextResponse.json(body, { status });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
