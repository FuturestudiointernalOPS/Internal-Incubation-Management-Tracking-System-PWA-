import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import { isWithinScope } from "@/lib/authorization/scope";
import { changeProgramManager } from "@/services/programs/programManager";

export const dynamic = "force-dynamic";

/**
 * PUT /api/pm/programs/[id]/manager
 *     body: { manager_cid: string | null }
 *     requires programs.edit
 *
 * Record who manages a program — the REPAIR action behind the readiness report.
 *
 * WHY IT MATTERS: the program scope rule matches a person to a program through
 * the manager relationship. A running program with no manager recorded can never
 * be matched, so only Super Admin can write to it until somebody assigns a
 * manager. The readiness report lists exactly those programs; this is the action
 * that clears one.
 *
 * TWO WAYS IN, deliberately, so the repair cannot deadlock. The scope rule would
 * otherwise refuse the very action that fixes the programs it cannot match
 * (nobody is staffed on an unmanaged program by definition):
 *
 *   1. INSIDE the program — the caller is STAFFED on it (its named manager, or
 *      an assigned staff member). That is the ordinary case.
 *   2. FROM THE PERMISSION CONSOLE — the caller holds the capability-assignment
 *      authority, because changing who manages a program IS an access change
 *      (it decides who receives the assignment-derived grants). Super Admin has
 *      both and bypasses scope entirely.
 *
 * A staff member holding only `programs.edit` still cannot touch a program they
 * are not staffed on — the rule the whole mechanism exists for is intact.
 *
 * The domain work (what recording a manager does, and the reconciliation of both
 * sides) lives in `@/services/programs/programManager`; the capability is
 * `programs.edit` — changing who runs a program is a program management write,
 * not a permissions-console write.
 */
export async function PUT(req, { params }) {
  try {
    await initDb();

    const capError = await requireAuthorization("programs", "edit");
    if (capError) return capError;

    // Read the program id BEFORE anything that needs it. The ordering is
    // load-bearing: a check placed above this line reads a not-yet-declared
    // binding and fails the request outright (the same defect the venture pilot
    // hit, and the same one the scope guards document).
    const { id } = await params;

    // The repair path. `programs.edit` alone is not enough: you must either be
    // staffed on the program (the ordinary case) or hold the authority to
    // configure access, which is what changing its manager is. Without the second
    // branch an unmanaged program could only ever be repaired by Super Admin.
    const session = await getSession();
    const isSuperAdmin = session?.role === "super_admin";
    if (!isSuperAdmin) {
      const staffedOnProgram = await isWithinScope(
        "program_staffed",
        session?.cid,
        id,
        { email: session?.email },
      );
      if (!staffedOnProgram) {
        const consoleAuthority = await requireAuthorization(
          "permissions",
          "assign_capabilities",
        );
        if (consoleAuthority) return consoleAuthority;
      }
    }

    const body = await req.json().catch(() => ({}));
    const managerCid =
      body?.manager_cid === undefined ? undefined : body.manager_cid;

    if (managerCid === undefined) {
      return NextResponse.json(
        { success: false, error: "manager_cid is required" },
        { status: 400 },
      );
    }

    const result = await changeProgramManager({
      programId: id,
      managerCid,
      actorCid: session?.cid || null,
    });

    if (result.errorKey) {
      return NextResponse.json(
        { success: false, error: result.errorKey },
        { status: result.status },
      );
    }
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    console.error("[program manager] error:", err);
    return NextResponse.json(
      { success: false, error: "errors.somethingWrong" },
      { status: 500 },
    );
  }
}
