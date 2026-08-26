import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";

/**
 * GET /api/investor/relationships/meetings
 * List meetings for a workspace. Query: workspace_id (required)
 */
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("investor", "view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspace_id");

    if (!workspaceId) {
      return NextResponse.json({ success: false, error: "workspace_id required" }, { status: 400 });
    }

    const result = await db.execute({
      sql: "SELECT * FROM relationship_meetings WHERE workspace_id = ? ORDER BY scheduled_date ASC, scheduled_time ASC",
      args: [workspaceId],
    });

    return NextResponse.json({ success: true, meetings: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/investor/relationships/meetings
 * Create a meeting. Admin only.
 */
export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const session = await getSession();
    const body = await req.json();
    const { workspace_id, meeting_type, scheduled_date, scheduled_time, duration_minutes, location, notes } = body;

    if (!workspace_id) {
      return NextResponse.json({ success: false, error: "workspace_id required" }, { status: 400 });
    }

    const result = await db.execute({
      sql: `INSERT INTO relationship_meetings (workspace_id, meeting_type, scheduled_date, scheduled_time, duration_minutes, location, notes, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled') RETURNING *`,
      args: [
        workspace_id,
        meeting_type || "introductory",
        scheduled_date || null,
        scheduled_time || null,
        duration_minutes || 60,
        location || null,
        notes || null,
      ],
    });

    const meeting = result.rows[0];

    // Get workspace info for timeline
    const ws = await db.execute({
      sql: "SELECT venture_id FROM relationship_workspaces WHERE id = ?",
      args: [workspace_id],
    });
    const ventureName = (await db.execute({
      sql: "SELECT name FROM v2_programs WHERE id = ?",
      args: [ws.rows[0]?.venture_id],
    })).rows[0]?.name || "Venture";

    // Timeline entry
    await db.execute({
      sql: `INSERT INTO relationship_timeline (workspace_id, event_type, description, actor_id)
            VALUES (?, 'meeting_scheduled', ?, ?)`,
      args: [workspace_id, `${meeting_type.replace(/_/g, " ")} meeting scheduled${scheduled_date ? " for " + scheduled_date : ""}`, session.cid || session.id],
    });

    return NextResponse.json({ success: true, meeting });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/investor/relationships/meetings
 * Update meeting (complete, add notes/outcome/actions). Admin only.
 */
export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const session = await getSession();
    const body = await req.json();
    const { id, status, notes, outcome, action_items, scheduled_date, scheduled_time, location, meeting_type } = body;

    if (!id) return NextResponse.json({ success: false, error: "meeting id required" }, { status: 400 });

    const sets = [];
    const args = [];

    if (status) { sets.push("status = ?"); args.push(status); }
    if (notes !== undefined) { sets.push("notes = ?"); args.push(notes); }
    if (outcome !== undefined) { sets.push("outcome = ?"); args.push(outcome); }
    if (action_items !== undefined) { sets.push("action_items = ?"); args.push(typeof action_items === "string" ? action_items : JSON.stringify(action_items)); }
    if (scheduled_date) { sets.push("scheduled_date = ?"); args.push(scheduled_date); }
    if (scheduled_time !== undefined) { sets.push("scheduled_time = ?"); args.push(scheduled_time); }
    if (location !== undefined) { sets.push("location = ?"); args.push(location); }
    if (meeting_type) { sets.push("meeting_type = ?"); args.push(meeting_type); }

    if (sets.length === 0) return NextResponse.json({ success: false, error: "Nothing to update" }, { status: 400 });

    sets.push("updated_at = NOW()");
    args.push(id);

    const result = await db.execute({
      sql: `UPDATE relationship_meetings SET ${sets.join(", ")} WHERE id = ? RETURNING *`,
      args,
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Meeting not found" }, { status: 404 });
    }

    const meeting = result.rows[0];

    // Timeline entry
    if (status === "completed") {
      // Get workspace id for timeline
      const ws = await db.execute({
        sql: "SELECT id, venture_id FROM relationship_workspaces WHERE id = (SELECT workspace_id FROM relationship_meetings WHERE id = ?)",
        args: [id],
      });
      if (ws.rows.length > 0) {
        const vName = (await db.execute({
          sql: "SELECT name FROM v2_programs WHERE id = ?",
          args: [ws.rows[0].venture_id],
        })).rows[0]?.name || "Venture";

        await db.execute({
          sql: `INSERT INTO relationship_timeline (workspace_id, event_type, description, actor_id)
                VALUES (?, 'meeting_completed', ?, ?)`,
          args: [ws.rows[0].id, `Meeting completed${outcome ? ": " + outcome : ""} for ${vName}`, session.cid || session.id],
        });

        // Update workspace next_action if action_items provided
        if (action_items) {
          const items = typeof action_items === "string" ? JSON.parse(action_items) : action_items;
          if (Array.isArray(items) && items.length > 0) {
            await db.execute({
              sql: "UPDATE relationship_workspaces SET next_action = ?, updated_at = NOW() WHERE id = ?",
              args: [items[0], ws.rows[0].id],
            });
          }
        }
      }
    }

    return NextResponse.json({ success: true, meeting });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
