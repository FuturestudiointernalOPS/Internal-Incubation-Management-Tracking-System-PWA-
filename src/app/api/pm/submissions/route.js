import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/pm/submissions?assigned_pm_id=X
 *
 * Returns all submissions for programs where this PM is assigned.
 * Includes program name, deliverable title, participant name.
 */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["staff", "super_admin", "program_manager"]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const assignedPmId = searchParams.get("assigned_pm_id");

    if (!assignedPmId) {
      return NextResponse.json(
        { success: false, error: "assigned_pm_id is required" },
        { status: 400 },
      );
    }

    // Get programs assigned to this PM
    const progRes = await db.execute({
      sql: "SELECT id, name FROM v2_programs WHERE assigned_pm_id = ? AND (is_archived = 0 OR is_archived IS NULL)",
      args: [assignedPmId],
    });
    const programs = progRes.rows || [];
    const programIds = programs.map((p) => p.id);

    if (programIds.length === 0) {
      return NextResponse.json({ success: true, submissions: [], programs });
    }

    // Fetch submissions for those programs
    const placeholders = programIds.map(() => "?").join(",");
    const subRes = await db.execute({
      sql: `SELECT s.*, d.title as deliverable_title, d.week_number as deliverable_week,
                   c.name as participant_name
            FROM v2_submissions s
            LEFT JOIN v2_document_requirements d ON s.deliverable_id = d.id
            LEFT JOIN contacts c ON s.participant_id = c.cid
            WHERE s.program_id IN (${placeholders})
            ORDER BY s.created_at DESC`,
      args: programIds,
    });

    // Attach program name to each submission
    const progMap = {};
    for (const p of programs) progMap[p.id] = p.name;
    const submissions = (subRes.rows || []).map((s) => ({
      ...s,
      program_name: progMap[s.program_id] || null,
    }));

    return NextResponse.json({ success: true, submissions, programs });
  } catch (error) {
    console.error("PM Submissions Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
