import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/** GET /api/investor/venture-kpis?venture_id=X — KPIs derived from Venture OS */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "staff", "investor"]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const ventureId = searchParams.get("venture_id");
    if (!ventureId) return NextResponse.json({ success: false, error: "venture_id required" }, { status: 400 });

    const prog = await db.execute({
      sql: "SELECT completion_index, status, start_date, end_date FROM v2_programs WHERE id = ?",
      args: [ventureId],
    });
    if (prog.rows.length === 0) return NextResponse.json({ success: true, kpis: [] });

    const p = prog.rows[0];
    const participants = await db.execute({
      sql: `SELECT COUNT(*) as count
            FROM participant_programs pp
            JOIN contacts c ON pp.participant_id = c.cid
            WHERE CAST(pp.program_id AS TEXT) = ?
              AND c.deleted = 0
              AND c.deleted_at IS NULL
              AND c.archived_at IS NULL
              AND LOWER(COALESCE(c.status, '')) = 'active'
              AND NOT EXISTS (
                SELECT 1 FROM v2_program_staff ps
                WHERE CAST(ps.program_id AS TEXT) = CAST(pp.program_id AS TEXT)
                  AND ps.role = 'facilitator'
                  AND (ps.staff_id = c.cid OR LOWER(TRIM(ps.staff_id)) = LOWER(TRIM(c.email)))
              )`,
      args: [ventureId],
    });
    const invested = await db.execute({
      sql: "SELECT COUNT(*) as count FROM investment_pipeline WHERE venture_id = ? AND stage = 'invested'",
      args: [ventureId],
    });

    const kpis = [
      { kpi_key: "completion", kpi_label: "Program Completion", kpi_value: `${Number(p.completion_index || 0).toFixed(0)}%`, trend: Number(p.completion_index || 0) > 50 ? "up" : "stable" },
      { kpi_key: "participants", kpi_label: "Participants", kpi_value: String(participants.rows[0]?.count || 0), trend: "stable" },
      { kpi_key: "investors", kpi_label: "Active Investors", kpi_value: String(invested.rows[0]?.count || 0), trend: "up" },
      { kpi_key: "status", kpi_label: "Venture Status", kpi_value: p.status || "active", trend: "stable" },
    ];

    return NextResponse.json({ success: true, kpis });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
