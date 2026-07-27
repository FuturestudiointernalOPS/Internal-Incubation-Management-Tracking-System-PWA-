import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";

/** GET /api/investor/diligence?pipeline_id=X */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "staff", "investor"]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const pipelineId = searchParams.get("pipeline_id");

    if (!pipelineId) {
      return NextResponse.json({ success: false, error: "pipeline_id required" }, { status: 400 });
    }

    // Workspace
    let workspace = null;
    const wsRes = await db.execute({
      sql: "SELECT * FROM due_diligence_workspaces WHERE pipeline_id = ?",
      args: [pipelineId],
    });
    if (wsRes.rows.length > 0) workspace = wsRes.rows[0];

    // Information requests
    let requests = [];
    if (workspace) {
      const reqRes = await db.execute({
        sql: "SELECT * FROM dd_information_requests WHERE workspace_id = ? ORDER BY created_at DESC",
        args: [workspace.id],
      });
      requests = reqRes.rows;
    }

    // Notes
    const notesRes = await db.execute({
      sql: "SELECT * FROM investor_notes WHERE pipeline_id = ? ORDER BY created_at DESC",
      args: [pipelineId],
    });

    // Pipeline info
    const pipeRes = await db.execute({
      sql: `SELECT ip.*, p.name as venture_name, p.description as venture_description,
                   p.industry, p.country, p.business_stage
            FROM investment_pipeline ip
            LEFT JOIN v2_programs p ON ip.venture_id = p.id
            WHERE ip.id = ?`,
      args: [pipelineId],
    });

    return NextResponse.json({
      success: true,
      workspace,
      requests,
      notes: notesRes.rows,
      pipeline: pipeRes.rows[0] || null,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** POST /api/investor/diligence — create/update workspace */
export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "staff", "investor"]);
    if (authError) return authError;

    const { pipeline_id, action, ...data } = await req.json();

    if (!pipeline_id) {
      return NextResponse.json({ success: false, error: "pipeline_id required" }, { status: 400 });
    }

    if (action === "create_workspace") {
      // Create workspace
      const res = await db.execute({
        sql: `INSERT INTO due_diligence_workspaces (pipeline_id, status)
              VALUES (?, 'active')
              ON CONFLICT (pipeline_id) DO UPDATE SET status = 'active', updated_at = NOW()
              RETURNING *`,
        args: [pipeline_id],
      });

      // Update pipeline stage
      await db.execute({
        sql: "UPDATE investment_pipeline SET stage = 'due_diligence', stage_changed_at = NOW(), updated_at = NOW() WHERE id = ?",
        args: [pipeline_id],
      });

      return NextResponse.json({ success: true, workspace: res.rows[0] });
    }

    if (action === "add_request") {
      const { title, description, category } = data;
      if (!title) return NextResponse.json({ success: false, error: "title required" }, { status: 400 });

      // Get workspace
      const ws = await db.execute({
        sql: "SELECT id FROM due_diligence_workspaces WHERE pipeline_id = ?",
        args: [pipeline_id],
      });
      if (ws.rows.length === 0) {
        return NextResponse.json({ success: false, error: "Workspace not found. Create it first." }, { status: 404 });
      }

      const res = await db.execute({
        sql: `INSERT INTO dd_information_requests (workspace_id, title, description, category)
              VALUES (?, ?, ?, ?) RETURNING *`,
        args: [ws.rows[0].id, title, description || null, category || "general"],
      });

      return NextResponse.json({ success: true, request: res.rows[0] });
    }

    if (action === "update_request") {
      const { request_id, status, response_text } = data;
      await db.execute({
        sql: "UPDATE dd_information_requests SET status = ?, response_text = ?, updated_at = NOW() WHERE id = ?",
        args: [status, response_text || null, request_id],
      });
      return NextResponse.json({ success: true });
    }

    if (action === "add_note") {
      const { content, note_type } = data;
      if (!content) return NextResponse.json({ success: false, error: "content required" }, { status: 400 });

      const session = await getSession();
      // Get investor profile
      const prof = await db.execute({
        sql: "SELECT id FROM investor_profiles WHERE user_id = ?",
        args: [session.cid || session.id],
      });

      const res = await db.execute({
        sql: `INSERT INTO investor_notes (investor_id, pipeline_id, note_type, content)
              VALUES (?, ?, ?, ?) RETURNING *`,
        args: [prof.rows[0]?.id, pipeline_id, note_type || "private", content],
      });

      return NextResponse.json({ success: true, note: res.rows[0] });
    }

    if (action === "complete") {
      await db.execute({
        sql: "UPDATE due_diligence_workspaces SET status = 'completed', updated_at = NOW() WHERE pipeline_id = ?",
        args: [pipeline_id],
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
