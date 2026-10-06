import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { getSession } from "@/server/auth/session";
import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";
import {
  listRelationshipsForViewer,
  createRelationshipWorkspace,
  updateRelationshipWorkspaceWithTimeline,
} from "@/services/investor";

/**
 * GET /api/investor/relationships
 * List relationship workspaces. Admin sees all; investor sees their own.
 *
 * The own-scope binding (the id comes from the request), the detail/list
 * assembly and the refusal live in `@/services/investor`.
 */
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("view");
    if (capError) return capError;

    const session = await getSession();
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("id");
    const ventureId = searchParams.get("venture_id");

    const result = await listRelationshipsForViewer({ workspaceId, ventureId, session });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    if (result.detail) return NextResponse.json({ success: true, ...result.detail });
    return NextResponse.json({ success: true, workspaces: result.workspaces });
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
    const { pipeline_id, relationship_manager_id, investment_manager_id } = await req.json();

    const result = await createRelationshipWorkspace({
      pipelineId: pipeline_id,
      relationshipManagerId: relationship_manager_id,
      investmentManagerId: investment_manager_id,
      session,
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, workspace: result.workspace });
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
    const { id, relationship_manager_id, investment_manager_id, status, current_stage, next_action } =
      body;

    const result = await updateRelationshipWorkspaceWithTimeline({
      id,
      fields: { relationship_manager_id, investment_manager_id, status, current_stage, next_action },
      session,
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, workspace: result.workspace });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
