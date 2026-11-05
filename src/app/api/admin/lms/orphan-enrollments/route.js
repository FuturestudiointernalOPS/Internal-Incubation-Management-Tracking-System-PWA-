import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/models/authorization/index";
import {
  listOrphanProgramEnrollments,
  suspendOrphanProgramEnrollments,
} from "@/services/lms/learning";

export const dynamic = "force-dynamic";

/**
 * ORPHANED PROGRAM LEARNING — the control behind a participant who kept course
 * access after leaving the program.
 *
 * GET  — program-sourced enrollments still granting access while no program
 *        seat justifies them (left behind by an older removal, a deleted
 *        program, or a membership recorded under another identity).
 * POST — { ids: [...] } suspends the selected ones. Suspended, not deleted:
 *        progress and history stay, access stops.
 *
 * Reading needs `lms.view`, fixing needs `lms.edit` — the same capabilities as
 * the rest of the LMS team screens.
 */

export async function GET() {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "view");
    if (capError) return capError;

    const enrollments = await listOrphanProgramEnrollments();
    return NextResponse.json({ success: true, enrollments });
  } catch (error) {
    console.error("[lms] listing orphan program enrollments failed:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "edit");
    if (capError) return capError;

    const body = await req.json();
    const result = await suspendOrphanProgramEnrollments(body?.ids);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[lms] suspending orphan program enrollments failed:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
