import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

export const dynamic = "force-dynamic";

export const GET = createHandler(
  { roles: ["staff", "super_admin", "program_manager"] },
  async (req) => {
    // Ensure indexes for performance
    try { await db.execute("CREATE INDEX IF NOT EXISTS idx_v2_submissions_participant_program ON v2_submissions(participant_id, program_id)"); } catch (_) {}
    try { await db.execute("CREATE INDEX IF NOT EXISTS idx_v2_submissions_deliverable ON v2_submissions(deliverable_id)"); } catch (_) {}
    try { await db.execute("CREATE INDEX IF NOT EXISTS idx_v2_submissions_program ON v2_submissions(program_id)"); } catch (_) {}
    const { searchParams } = new URL(req.url);
    const assignedPmId = searchParams.get("assigned_pm_id");

    if (!assignedPmId) {
      return NextResponse.json(
        { success: false, error: "assigned_pm_id is required" },
        { status: 400 },
      );
    }

    const progRes = await db.execute({
      sql: "SELECT id, name FROM v2_programs WHERE assigned_pm_id = ? AND (is_archived = 0 OR is_archived IS NULL)",
      args: [assignedPmId],
    });
    const programs = progRes.rows || [];
    const programIds = programs.map((p) => String(p.id));

    if (programIds.length === 0) {
      return NextResponse.json({ success: true, submissions: [], programs });
    }

    const placeholders = programIds.map(() => "?").join(",");
    const subRes = await db.execute({
      sql: `SELECT s.*, d.title as deliverable_title, d.week_number as deliverable_week,
                   c.name as participant_name, c.group_name as participant_group,
                   prog.grading_mode
			FROM v2_submissions s
            LEFT JOIN v2_document_requirements d ON s.deliverable_id::text = d.id::text
            LEFT JOIN contacts c ON s.participant_id::text = c.cid
            LEFT JOIN v2_programs prog ON s.program_id::text = prog.id::text
            WHERE s.program_id::text IN (${placeholders})
            ORDER BY s.created_at DESC`,
      args: programIds,
    });

    const progMap = {};
    for (const p of programs) progMap[p.id] = p.name;
    const submissions = (subRes.rows || []).map((s) => ({
      ...s,
      program_name: progMap[s.program_id] || null,
    }));

    return NextResponse.json({ success: true, submissions, programs });
  },
);
