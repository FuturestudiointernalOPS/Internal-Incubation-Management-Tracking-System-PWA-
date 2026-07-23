import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";

/** POST /api/investor/pipeline — add venture to pipeline or update stage */
export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "staff", "investor"]);
    if (authError) return authError;

    const session = await getSession();
    const user = session;
    const { venture_id, stage, notes } = await req.json();

    if (!venture_id) {
      return NextResponse.json({ success: false, error: "venture_id required" }, { status: 400 });
    }

    // Get investor profile
    const profile = await db.execute({
      sql: "SELECT id FROM investor_profiles WHERE user_id = ?",
      args: [user.cid || user.id],
    });
    if (profile.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Investor profile not found" }, { status: 404 });
    }

    const investorId = profile.rows[0].id;
    const validStages = ["interested", "watching", "meeting_requested", "due_diligence", "negotiation", "invested", "declined"];
    const newStage = stage || "interested";

    if (!validStages.includes(newStage)) {
      return NextResponse.json({ success: false, error: "Invalid stage" }, { status: 400 });
    }

    // Upsert pipeline entry
    const result = await db.execute({
      sql: `INSERT INTO investment_pipeline (investor_id, venture_id, stage, notes, stage_changed_at)
            VALUES (?, ?, ?, ?, NOW())
            ON CONFLICT (investor_id, venture_id)
            DO UPDATE SET stage = EXCLUDED.stage, notes = EXCLUDED.notes,
                          stage_changed_at = NOW(), updated_at = NOW()
            RETURNING *`,
      args: [investorId, venture_id, newStage, notes || null],
    });

    // If stage is "invested", auto-create a decision record
    if (newStage === "invested") {
      const pipelineId = result.rows[0].id;
      await db.execute({
        sql: `INSERT INTO investment_decisions (pipeline_id, decision_type, decision_date, decision_notes)
              VALUES (?, 'invest', CURRENT_DATE, ?)
              ON CONFLICT (pipeline_id) DO NOTHING`,
        args: [pipelineId, notes || null],
      });
    }

    return NextResponse.json({ success: true, pipeline: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** GET /api/investor/pipeline — list pipeline for current investor or by venture */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "staff", "investor", "program_manager"]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const ventureId = searchParams.get("venture_id");

    const session = await getSession();
    const user = session;
    let sql, args;

    if (ventureId) {
      sql = `SELECT ip.*, p.name as venture_name
             FROM investment_pipeline ip
             LEFT JOIN v2_programs p ON ip.venture_id = p.id
             WHERE ip.venture_id = ?`;
      args = [ventureId];
    } else {
      const profile = await db.execute({
        sql: "SELECT id FROM investor_profiles WHERE user_id = ?",
        args: [user.cid || user.id],
      });
      if (profile.rows.length === 0) {
        return NextResponse.json({ success: true, pipeline: [] });
      }
      sql = `SELECT ip.*, p.name as venture_name
             FROM investment_pipeline ip
             LEFT JOIN v2_programs p ON ip.venture_id = p.id
             WHERE ip.investor_id = ?
             ORDER BY ip.stage_changed_at DESC`;
      args = [profile.rows[0].id];
    }

    const result = await db.execute({ sql, args });
    return NextResponse.json({ success: true, pipeline: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
