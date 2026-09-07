import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import {
  getVentureIdByWorkspaceId,
  getVentureNameForCompletedMeeting,
  getVentureNameForScheduledMeeting,
  getWorkspaceForMeetingCompletion,
  insertMeetingCompletedTimeline,
  insertMeetingScheduledTimeline,
  insertRelationshipMeeting,
  listMeetingsForWorkspace,
  setWorkspaceNextAction,
  updateRelationshipMeeting,
} from "@/models/investorRelations";

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

    const result = await listMeetingsForWorkspace(workspaceId);

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

    const result = await insertRelationshipMeeting(
      workspace_id,
      meeting_type || "introductory",
      scheduled_date || null,
      scheduled_time || null,
      duration_minutes || 60,
      location || null,
      notes || null,
    );

    const meeting = result.rows[0];

    // Get workspace info for timeline
    const ws = await getVentureIdByWorkspaceId(workspace_id);
    const ventureName = (await getVentureNameForScheduledMeeting(ws.rows[0]?.venture_id)).rows[0]?.name || "Venture";

    // Timeline entry
    await insertMeetingScheduledTimeline(workspace_id, `${meeting_type.replace(/_/g, " ")} meeting scheduled${scheduled_date ? " for " + scheduled_date : ""}`, session.cid || session.id);

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

    const result = await updateRelationshipMeeting(id, {
      status,
      notes,
      outcome,
      action_items,
      scheduled_date,
      scheduled_time,
      location,
      meeting_type,
    });

    if (result.updated === false) return NextResponse.json({ success: false, error: "Nothing to update" }, { status: 400 });

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Meeting not found" }, { status: 404 });
    }

    const meeting = result.rows[0];

    // Timeline entry
    if (status === "completed") {
      // Get workspace id for timeline
      const ws = await getWorkspaceForMeetingCompletion(id);
      if (ws.rows.length > 0) {
        const vName = (await getVentureNameForCompletedMeeting(ws.rows[0].venture_id)).rows[0]?.name || "Venture";

        await insertMeetingCompletedTimeline(ws.rows[0].id, `Meeting completed${outcome ? ": " + outcome : ""} for ${vName}`, session.cid || session.id);

        // Update workspace next_action if action_items provided
        if (action_items) {
          const items = typeof action_items === "string" ? JSON.parse(action_items) : action_items;
          if (Array.isArray(items) && items.length > 0) {
            await setWorkspaceNextAction(items[0], ws.rows[0].id);
          }
        }
      }
    }

    return NextResponse.json({ success: true, meeting });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
