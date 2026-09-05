import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getAdminOverviewStats,
  listAdminOverviewPipelines,
  listAdminOverviewRequests,
  listAdminOverviewWorkspaces,
} from "@/models/investor";

/** GET /api/investor/admin-overview — super admin DD/pipeline overview */
export async function GET() {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const [workspaces, pipelines, stats, requests] = await Promise.all([
      listAdminOverviewWorkspaces(),
      listAdminOverviewPipelines(),
      getAdminOverviewStats(),
      listAdminOverviewRequests(),
    ]);

    return NextResponse.json({
      success: true,
      workspaces: workspaces.rows,
      pipelines: pipelines.rows,
      stats: stats.rows[0],
      requests: requests.rows,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
