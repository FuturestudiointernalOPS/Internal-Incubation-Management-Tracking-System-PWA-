import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireAuthorization } from "@/models/authorization/index";
import { requireProgramScope } from "@/lib/programScopedAccess";
import {
  deleteCurriculumItem,
  resolveActionScopeProgramId,
  resolveRecordScopeProgramId,
  runCurriculumAction,
  updateCurriculum,
} from "@/services/programs/curriculum";

/**
 * The program curriculum controller: sessions, requirements and the weekly
 * report. It authenticates, applies the `programs.edit` capability and the
 * `wave: "content"` record scope, then delegates to
 * `@/services/programs/curriculum`.
 */

export async function POST(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("programs", "edit");
    if (capError) return capError;
    const payload = await req.json();
    const { program_id, action } = payload;

    if (!program_id)
      return NextResponse.json(
        { success: false, error: "Program ID missing" },
        { status: 400 },
      );

    // Record scope: `programs.edit` says WHAT may be written; this says WHICH
    // program. Creating actions write into the payload's program, but record
    // actions (toggle/assign/anchor) target an existing row by id, so the
    // program is resolved from THAT row — a client-supplied program_id must
    // never authorise a foreign record.
    const scopeProgramId = await resolveActionScopeProgramId({ action, payload });
    const scopeError = await requireProgramScope({ programId: scopeProgramId, wave: "content" });
    if (scopeError) return scopeError;

    const result = await runCurriculumAction({ payload });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        success: false,
        error: `Curriculum feature not available in this schema: ${error.message}`,
      },
      { status: 501 },
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("programs", "edit");
    if (capError) return capError;
    const session = await getSession();
    const userId = session?.cid || session?.id || null;
    const payload = await req.json();
    const { id, sessionId, field, type } = payload;
    const targetId = id || sessionId;

    // Record scope: the target is an existing session (field update / legacy
    // update) or a document requirement. The program is resolved from the record
    // itself — never from the payload — so a forged program_id cannot authorise
    // a foreign record.
    const scopeProgramId = await resolveRecordScopeProgramId({ targetId, field, type });
    const scopeError = await requireProgramScope({ programId: scopeProgramId, wave: "content" });
    if (scopeError) return scopeError;

    const result = await updateCurriculum({ payload, userId });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        success: false,
        error: `Curriculum feature not available in this schema: ${error.message}`,
      },
      { status: 501 },
    );
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("programs", "edit");
    if (capError) return capError;
    const { id, type } = await req.json();

    // Resolve the program from the record that is about to be deleted — never
    // from the payload — so a forged program_id cannot authorise a foreign row.
    const targetProgramId = await resolveRecordScopeProgramId({ targetId: id, type });
    const scopeError = await requireProgramScope({ programId: targetProgramId, wave: "content" });
    if (scopeError) return scopeError;

    const result = await deleteCurriculumItem({ id, type, programId: targetProgramId });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        success: false,
        error: `Curriculum feature not available in this schema: ${error.message}`,
      },
      { status: 501 },
    );
  }
}
