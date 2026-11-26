import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { getSession } from "@/server/auth/session";
import { requireProgramFacilitator } from "@/server/authz/guards";
import { isProgramManagerSession } from "@/services/authorization/programManagement";
import { isAssignedPmForProgram } from "@/models/authorization/accessQueries";
import { buildProgramFullState } from "@/services/programs/fullState";
import { projectProgramAccess } from "@/services/authorization/programAccessProjection";
import { refusalResponse } from "@/server/http/refusal";

export const dynamic = "force-dynamic";

/**
 * The program workspace bundle. The controller authenticates, applies the
 * assigned-PM / facilitator gate and shapes the answer; the assembly lives in
 * `@/services/programs/fullState`.
 */
export async function GET(req) {
  try {
    await initDb();
    // Phase I6B: access is decided below for every non-management session —
    // assigned PM of the program, else requireProgramFacilitator (program
    // assignment). The removed role pre-filter blocked baseline Members who
    // hold a legitimate facilitator assignment.
    const authError = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const includeMetrics = searchParams.get("metrics") === "true";

    // Facilitators must be assigned to this program before seeing its data.
    // Bypass for: super_admin, program_manager (hasProgramManagementAccess)
    // AND for any staff member who is the explicitly assigned PM of this program.
    if (id) {
      const session = await getSession();
      if (session && !(await isProgramManagerSession(session))) {
        const isPm = await isAssignedPmForProgram(id, session.cid);
        if (!isPm) {
          const guardError = await requireProgramFacilitator(id);
          if (guardError) return guardError;
        }
      }
    }

    if (!id) return NextResponse.json({ success: false, error: "ID required" });

    const body = await buildProgramFullState({ id, includeMetrics });
    if (!body.success) return refusalResponse({ status: 404, errorKey: "errors.notFound" });
    // Lot 7.3 — the decision this screen's writes will meet, shaped for display.
    // `access` is the answer of the SAME unified decision the routes enforce; it
    // is never authority (every write re-decides).
    const access = await projectProgramAccess(id);
    return NextResponse.json({ ...body, access });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
