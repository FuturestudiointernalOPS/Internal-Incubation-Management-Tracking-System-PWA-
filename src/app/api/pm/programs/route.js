import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import { requireProgramScope } from "@/lib/programScopedAccess";
import {
  createProgramRecord,
  deleteProgramRecord,
  listProgramRecords,
  updateProgramRecord,
} from "@/services/programs/workspace";
export const dynamic = "force-dynamic";

/**
 * PROGRAMS API — OPERATIONAL INTELLIGENCE
 * Handles program lifecycle, completion metrics, and resource association.
 *
 * The controller keeps auth, the record-scope wave, request validation and the
 * response envelope; the use cases live in `@/services/programs/workspace`.
 */

export async function GET(req) {
  try {
    await initDb();
    // Phase I6B: the service below scopes every non-management session to its
    // own program-staff assignments (membership-keyed), so authentication
    // alone is safe here. Management roles + staff stay unscoped.
    const authError = await requireAuth();
    if (authError) return authError;
    const session = await getSession();
    const url = new URL(req.url);
    const assignedPmId = url.searchParams.get("assigned_pm_id");
    const showArchivedRaw = url.searchParams.get("show_archived");
    const status = url.searchParams.get("status");

    const result = await listProgramRecords({
      showAll: showArchivedRaw === "all",
      showArchived: showArchivedRaw === "true",
      status,
      assignedPmId,
      session,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("GET Programs Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError;
    // Phase 2 (legacy cleanup): no more staff compatibility bypass — program
    // creation requires the programs.create capability through the resolver.
    const capError = await requireAuthorization("programs", "create");
    if (capError) return capError;

    const payload = await req.json();
    const session = await getSession();

    const result = await createProgramRecord({ payload, actor: session });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("POST Program Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    // Phase I6B: program editing is decided by the programs.edit capability
    // below (resolver + eligibility). Authentication only here.
    const authError = await requireAuth();
    if (authError) return authError;
    // Phase 2 (legacy cleanup): no more staff/admin compatibility
    // bypass — program editing requires the programs.edit capability through
    // the resolver (eligibility boundary included). PMs hold it via their
    // profile; plain staff without it are denied (intended model).
    const capError = await requireAuthorization("programs", "edit");
    if (capError) return capError;

    const payload = await req.json();
    const { id } = payload;

    if (!id)
      return NextResponse.json(
        { success: false, error: "ID required" },
        { status: 400 },
      );

    // Program scope (wave: content) — evaluated AFTER the body is read, so the
    // program id is known. A check placed before the destructuring would read a
    // not-yet-declared binding and fail the request outright, so the order here
    // is load-bearing (the same defect was fixed once in the venture pilot).
    //
    // OFF by default: a no-op until an administrator switches the wave on from
    // the Operations screen (src/lib/programScopedAccess.js). The capability
    // above decides WHAT; this decides WHICH PROGRAM, on staffing rather than
    // enrollment.
    const scopeError = await requireProgramScope({
      programId: id,
      wave: "content",
    });
    if (scopeError) return scopeError;

    const session = await getSession();
    const result = await updateProgramRecord({ payload, actor: session });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("PUT Program Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("programs", "delete");
    if (capError) return capError;

    const { id } = await req.json();

    if (!id)
      return NextResponse.json(
        { success: false, error: "ID required" },
        { status: 400 },
      );

    // Program scope (wave: content) — the same guard as the PUT above.
    const scopeError = await requireProgramScope({
      programId: id,
      wave: "content",
    });
    if (scopeError) return scopeError;

    const result = await deleteProgramRecord({ id });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
