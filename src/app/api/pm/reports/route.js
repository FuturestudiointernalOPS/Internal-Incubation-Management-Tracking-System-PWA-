import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { getSession, requireAuth, requireAssignmentAccess } from "@/lib/auth";
import { requireAuthorization } from "@/models/authorization/index";
import { requireProgramScope } from "@/lib/programScopedAccess";
import {
  listWeeklyReportsForSession,
  saveWeeklyReport,
} from "@/services/programs/weeklyReports";

/**
 * GET /api/pm/reports — weekly program reports, newest first.
 *
 * Optional `program_id` / `week_number` filters. Management roles + staff read
 * the full list; any other session must prove a program assignment and then
 * sees only the reports it filed itself. The read lives in
 * `@/services/programs/weeklyReports`.
 */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");
    const weekNumber = searchParams.get("week_number");

    const session = await getSession();
    const fullAccess = ["staff", "super_admin", "program_manager"].includes(
      session?.role,
    );
    if (session && !fullAccess) {
      if (!programId) {
        return NextResponse.json(
          { success: false, error: "errors.insufficientPermissions" },
          { status: 403 },
        );
      }
      const guardError = await requireAssignmentAccess({
        resource: "program",
        contextId: programId,
      });
      if (guardError) return guardError;
    }

    const body = await listWeeklyReportsForSession({
      programId,
      weekNumber,
      fullAccess,
      sessionCid: session?.cid,
    });
    return NextResponse.json(body);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/**
 * POST /api/pm/reports — program-manager weekly report.
 *
 * Split out of the (degraded) curriculum controller so that a schema-drift
 * failure reports the real database error instead of a blanket 501. The body is
 * the payload the PM workspace sends; a legacy `action: "submit_pm_report"`
 * field is accepted and ignored.
 */
export async function POST(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("programs", "edit");
    if (capError) return capError;
    const payload = await req.json();
    const { program_id } = payload;

    if (!program_id)
      return NextResponse.json(
        { success: false, error: "Program ID missing" },
        { status: 400 },
      );

    // Record scope: `programs.edit` says WHAT may be written; a delegated holder
    // must be staffed on the program the report belongs to.
    const scopeError = await requireProgramScope({ programId: program_id, wave: "content" });
    if (scopeError) return scopeError;

    const result = await saveWeeklyReport({ payload });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
