import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
import { buildProgramScopeReadiness } from "@/models/authorization/programScopeReadiness";

export const dynamic = "force-dynamic";

/**
 * GET /api/engineering/permissions/program-scope-readiness
 *     requires permissions.view_matrix
 *
 * READ-ONLY. The measurement that makes enforcing the program scope rule safe.
 *
 * Three answers:
 *
 *   unmanaged[]        running programs with NO manager recorded. The rule
 *                      matches on that relationship, so these can never be
 *                      matched — enforcing scope first would make them
 *                      unreachable. This is the repair WORKLIST (step 2).
 *   holders[]          people whose template grants program editing, with the
 *                      running programs they are attached to. `losesEverything`
 *                      marks the ones the rule would leave with nothing — the
 *                      number that decides whether it can be switched on.
 *   portfolioTemplates[] and removals[]
 *                      which templates bundle program capability with unrelated
 *                      powers, and exactly which capabilities a portfolio
 *                      template would stop granting (step 3).
 *
 * Nothing here changes access.
 */
export async function GET() {
  try {
    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    const report = await buildProgramScopeReadiness();
    return NextResponse.json(report);
  } catch (err) {
    console.error("[Program Scope Readiness] error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
