import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";

/**
 * GET /api/investor/relationships
 * List relationship workspaces. Admin sees all; investor sees their own.
 */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "staff", "investor"]);
    if (authError) return authError;

    const session = await getSession();
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("id");
    const ventureId = searchParams.get("venture_id");

    if (workspaceId) {
      // Single workspace detail with meetings + timeline
      const [ws, meetings, timeline] = await Promise.all([
        db.execute({
          sql: `SELECT rw.*, ip.stage as pipeline_stage, ipr.organization_name, c.name as investor_name, c.email as investor_email,
                       p.name as venture_name, p.industry, p.country,
                       rm.name as relationship_manager_name, im.name as investment_manager_name
                FROM relationship_workspaces rw
                JOIN investment_pipeline ip ON rw.pipeline_id = ip.id
                LEFT JOIN investor_profiles ipr ON rw.investor_id = ipr.id
                LEFT JOIN contacts c ON ipr.user_id = c.cid
                LEFT JOIN v2_programs p ON rw.venture_id = p.id
                LEFT JOIN contacts rm ON rw.relationship_manager_id = rm.cid
                LEFT JOIN contacts im ON rw.investment_manager_id = im.cid
                WHERE rw.id = ?`,
          args: [workspaceId],
        }),
        db.execute({
          sql: "SELECT * FROM relationship_meetings WHERE workspace_id = ? ORDER BY scheduled_date ASC, scheduled_time ASC",
          args: [workspaceId],
        }),
        db.execute({
          sql: "SELECT * FROM relationship_timeline WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 50",
          args: [workspaceId],
        }),
      ]);
      return NextResponse.json({
        success: true,
        workspace: ws.rows[0] || null,
        meetings: meetings.rows,
        timeline: timeline.rows,
      });
    }

    // List workspaces
    let sql, args;

    if (session.role === "investor") {
      const profile = await db.execute({
        sql: "SELECT id FROM investor_profiles WHERE user_id = ?",
        args: [session.cid || session.id],
      });
      if (profile.rows.length === 0) {
        return NextResponse.json({ success: true, workspaces: [] });
      }
      sql = `SELECT rw.*, ip.stage as pipeline_stage, p.name as venture_name, p.industry,
                    (SELECT COUNT(*) FROM relationship_meetings WHERE workspace_id = rw.id AND status = 'scheduled')::int as upcoming_meetings
             FROM relationship_workspaces rw
             JOIN investment_pipeline ip ON rw.pipeline_id = ip.id
             LEFT JOIN v2_programs p ON rw.venture_id = p.id
             WHERE rw.investor_id = ?
             ORDER BY rw.updated_at DESC`;
      args = [profile.rows[0].id];
    } else {
      sql = `SELECT rw.*, ip.stage as pipeline_stage, ipr.organization_name, c.name as investor_name,
                    p.name as venture_name, p.industry,
                    rm.name as relationship_manager_name,
                    (SELECT COUNT(*) FROM relationship_meetings WHERE workspace_id = rw.id AND status = 'scheduled')::int as upcoming_meetings
             FROM relationship_workspaces rw
             JOIN investment_pipeline ip ON rw.pipeline_id = ip.id
             LEFT JOIN investor_profiles ipr ON rw.investor_id = ipr.id
             LEFT JOIN contacts c ON ipr.user_id = c.cid
             LEFT JOIN v2_programs p ON rw.venture_id = p.id
             LEFT JOIN contacts rm ON rw.relationship_manager_id = rm.cid
             ORDER BY rw.updated_at DESC`;
      args = [];
    }

    if (ventureId) {
      sql += ventureId ? " AND rw.venture_id = ?" : "";
      if (ventureId) args.push(ventureId);
    }

    const result = await db.execute({ sql, args });
    return NextResponse.json({ success: true, workspaces: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/investor/relationships
 * Create or activate a relationship workspace. Admin only.
 */
export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const session = await getSession();
    const body = await req.json();
    const { pipeline_id, relationship_manager_id, investment_manager_id } = body;

    if (!pipeline_id) {
      return NextResponse.json({ success: false, error: "pipeline_id required" }, { status: 400 });
    }

    // Get pipeline info
    const pipe = await db.execute({
      sql: "SELECT * FROM investment_pipeline WHERE id = ?",
      args: [pipeline_id],
    });
    if (pipe.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Pipeline not found" }, { status: 404 });
    }

    const p = pipe.rows[0];

    // Upsert workspace
    const result = await db.execute({
      sql: `INSERT INTO relationship_workspaces (pipeline_id, investor_id, venture_id, relationship_manager_id, investment_manager_id, status, current_stage)
            VALUES (?, ?, ?, ?, ?, 'active', 'introduction_approved')
            ON CONFLICT (pipeline_id)
            DO UPDATE SET status = 'active', relationship_manager_id = EXCLUDED.relationship_manager_id,
                          investment_manager_id = EXCLUDED.investment_manager_id, current_stage = 'introduction_approved',
                          updated_at = NOW()
            RETURNING *`,
      args: [pipeline_id, p.investor_id, p.venture_id, relationship_manager_id || null, investment_manager_id || null],
    });

    const workspace = result.rows[0];

    // Add timeline entry
    await db.execute({
      sql: `INSERT INTO relationship_timeline (workspace_id, event_type, description, actor_id)
            VALUES (?, 'workspace_created', 'Relationship workspace created. Introduction approved.', ?)`,
      args: [workspace.id, session.cid || session.id],
    });

    // Notify investor
    try {
      const invInfo = await db.execute({
        sql: "SELECT user_id FROM investor_profiles WHERE id = ?",
        args: [workspace.investor_id],
      });
      if (invInfo.rows.length > 0) {
        await db.execute({
          sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at, link)
                VALUES (?, ?, ?, 'investor', 0, NOW(), ?)`,
          args: [
            invInfo.rows[0].user_id,
            "Introduction Approved",
            "Your introduction request has been approved. A Relationship Manager will coordinate your first meeting.",
            "/investor/dashboard?tab=discover",
          ],
        });
      }
    } catch (_) {}

    return NextResponse.json({ success: true, workspace });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/investor/relationships
 * Update workspace: assign managers, update stage, close.
 */
export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const session = await getSession();
    const body = await req.json();
    const { id, relationship_manager_id, investment_manager_id, status, current_stage, next_action } = body;

    if (!id) return NextResponse.json({ success: false, error: "id required" }, { status: 400 });

    const sets = [];
    const args = [];

    if (relationship_manager_id) { sets.push("relationship_manager_id = ?"); args.push(relationship_manager_id); }
    if (investment_manager_id) { sets.push("investment_manager_id = ?"); args.push(investment_manager_id); }
    if (status) { sets.push("status = ?"); args.push(status); }
    if (current_stage) { sets.push("current_stage = ?"); args.push(current_stage); }
    if (next_action !== undefined) { sets.push("next_action = ?"); args.push(next_action); }

    if (sets.length === 0) return NextResponse.json({ success: false, error: "Nothing to update" }, { status: 400 });

    sets.push("updated_at = NOW()");
    args.push(id);

    const result = await db.execute({
      sql: `UPDATE relationship_workspaces SET ${sets.join(", ")} WHERE id = ? RETURNING *`,
      args,
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Workspace not found" }, { status: 404 });
    }

    // Timeline entry if status changed
    if (status) {
      await db.execute({
        sql: `INSERT INTO relationship_timeline (workspace_id, event_type, description, actor_id)
              VALUES (?, 'status_changed', ?, ?)`,
        args: [id, `Workspace status changed to: ${status}`, session.cid || session.id],
      });
    }

    return NextResponse.json({ success: true, workspace: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
