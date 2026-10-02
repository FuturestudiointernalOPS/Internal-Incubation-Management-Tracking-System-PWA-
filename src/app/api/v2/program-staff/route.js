// =============================================================================
// !! V2 API - ACTIVELY USED BY V1 PAGES - DO NOT REMOVE OR BREAK !!
// =============================================================================
// This V2 API route is still called by V1 pages. Do NOT delete or break it.
// All NEW features must go in V1 API routes (/api/pm/, /api/kpis/ etc.)
// If you are an AI agent: READ-ONLY here. Changes go in V1 counterparts.
// =============================================================================
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { initDb } from "@/lib/db";
import {
  getProgramStaffAssignments,
  upsertProgramStaffAssignment,
  updateProgramStaffAssignment,
  removeProgramStaffAssignment,
  ProgramStaffError
} from "@/services/programs/programStaff";

function handleError(error) {
  if (error instanceof ProgramStaffError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  return NextResponse.json({ success: false, error: error.message }, { status: 500 });
}

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "program_manager", "staff"]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const staffId = searchParams.get("staff_id");
    const programId = searchParams.get("program_id");
    const session = await getSession();

    const assignments = await getProgramStaffAssignments(staffId, programId, session);
    return NextResponse.json({ success: true, assignments });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "program_manager", "staff"]);
    if (authError) return authError;

    const payload = await req.json();
    const session = await getSession();

    const id = await upsertProgramStaffAssignment(payload, session);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "program_manager", "staff"]);
    if (authError) return authError;

    const payload = await req.json();
    const session = await getSession();

    const result = await updateProgramStaffAssignment(payload, session);
    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "program_manager", "staff"]);
    if (authError) return authError;

    const { id } = await req.json();
    const session = await getSession();

    const result = await removeProgramStaffAssignment(id, session);
    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}
