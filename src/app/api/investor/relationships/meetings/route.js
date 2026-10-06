import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { getSession } from "@/server/auth/session";
import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";
import {
  listMeetingsForViewer,
  createRelationshipMeeting,
  updateRelationshipMeetingCascade,
} from "@/services/investor";

/**
 * GET /api/investor/relationships/meetings
 * List meetings for a workspace. Query: workspace_id (required)
 *
 * The own-scope binding of the workspace lives in `@/services/investor`.
 */
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspace_id");

    const result = await listMeetingsForViewer({ workspaceId, session: await getSession() });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, meetings: result.meetings });
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
    const {
      workspace_id,
      meeting_type,
      scheduled_date,
      scheduled_time,
      duration_minutes,
      location,
      notes,
    } = body;

    const result = await createRelationshipMeeting({
      workspaceId: workspace_id,
      meetingType: meeting_type,
      scheduledDate: scheduled_date,
      scheduledTime: scheduled_time,
      durationMinutes: duration_minutes,
      location,
      notes,
      session,
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, meeting: result.meeting });
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
    const {
      id,
      status,
      notes,
      outcome,
      action_items,
      scheduled_date,
      scheduled_time,
      location,
      meeting_type,
    } = body;

    const result = await updateRelationshipMeetingCascade({
      id,
      fields: {
        status,
        notes,
        outcome,
        action_items,
        scheduled_date,
        scheduled_time,
        location,
        meeting_type,
      },
      session,
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, meeting: result.meeting });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
