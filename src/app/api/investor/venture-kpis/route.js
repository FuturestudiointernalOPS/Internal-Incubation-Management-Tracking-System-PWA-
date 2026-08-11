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
      sql: "SELECT COUNT(*) as count FROM v2_participants WHERE program_id = ?",
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
