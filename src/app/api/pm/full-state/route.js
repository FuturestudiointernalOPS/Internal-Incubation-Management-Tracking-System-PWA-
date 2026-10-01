import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  requireAuth,
  getSession,
  requireProgramFacilitator,
  hasProgramManagementAccess,
  isAssignedPmForProgram,
} from "@/lib/auth";
import { buildProgramFullState } from "@/services/programs/fullState";

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
      if (session && !hasProgramManagementAccess(session.role)) {
        const isPm = await isAssignedPmForProgram(id, session.cid);
        if (!isPm) {
          const guardError = await requireProgramFacilitator(id);
          if (guardError) return guardError;
        }
      }
    }

    if (!id) return NextResponse.json({ success: false, error: "ID required" });

    const body = await buildProgramFullState({ id, includeMetrics });
    return NextResponse.json(body);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
