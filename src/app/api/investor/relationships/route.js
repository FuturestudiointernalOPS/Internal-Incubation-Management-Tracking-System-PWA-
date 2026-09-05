import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import {
  getInvestorProfileByUserId,
  getInvestorUserIdByProfileId,
  getPipelineById,
  getRelationshipWorkspaceDetail,
  insertWorkspaceCreatedTimeline,
  insertWorkspaceStatusChangedTimeline,
  listRelationshipWorkspaces,
  listWorkspaceMeetings,
  listWorkspaceTimeline,
  notifyIntroductionApproved,
  updateRelationshipWorkspace,
  upsertRelationshipWorkspace,
} from "@/models/investorRelations";

/**
 * GET /api/investor/relationships
 * List relationship workspaces. Admin sees all; investor sees their own.
 */
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("investor", "view");
    if (capError) return capError;

    const session = await getSession();
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("id");
    const ventureId = searchParams.get("venture_id");

    if (workspaceId) {
      // Single workspace detail with meetings + timeline
      const [ws, meetings, timeline] = await Promise.all([
        getRelationshipWorkspaceDetail(workspaceId),
        listWorkspaceMeetings(workspaceId),
        listWorkspaceTimeline(workspaceId),
      ]);
      return NextResponse.json({
        success: true,
        workspace: ws.rows[0] || null,
        meetings: meetings.rows,
        timeline: timeline.rows,
      });
    }

    // List workspaces
    let investorId;

    if (session.role === "investor") {
      const profile = await getInvestorProfileByUserId(session.cid || session.id);
      if (profile.rows.length === 0) {
        return NextResponse.json({ success: true, workspaces: [] });
      }
      investorId = profile.rows[0].id;
    }

    const result = await listRelationshipWorkspaces({ role: session.role, investorId, ventureId });
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
    const pipe = await getPipelineById(pipeline_id);
    if (pipe.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Pipeline not found" }, { status: 404 });
    }

    const p = pipe.rows[0];

    // Upsert workspace
    const result = await upsertRelationshipWorkspace(
      pipeline_id,
      p.investor_id,
      p.venture_id,
      relationship_manager_id || null,
      investment_manager_id || null,
    );

    const workspace = result.rows[0];

    // Add timeline entry
    await insertWorkspaceCreatedTimeline(workspace.id, session.cid || session.id);

    // Notify investor
    try {
      const invInfo = await getInvestorUserIdByProfileId(workspace.investor_id);
      if (invInfo.rows.length > 0) {
        await notifyIntroductionApproved(invInfo.rows[0].user_id);
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

    const result = await updateRelationshipWorkspace(id, {
      relationship_manager_id,
      investment_manager_id,
      status,
      current_stage,
      next_action,
    });

    if (result.updated === false) return NextResponse.json({ success: false, error: "Nothing to update" }, { status: 400 });

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Workspace not found" }, { status: 404 });
    }

    // Timeline entry if status changed
    if (status) {
      await insertWorkspaceStatusChangedTimeline(id, `Workspace status changed to: ${status}`, session.cid || session.id);
    }

    return NextResponse.json({ success: true, workspace: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
