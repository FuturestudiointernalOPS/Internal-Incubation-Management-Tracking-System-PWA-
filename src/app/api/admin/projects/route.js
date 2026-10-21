import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/models/authorization/index";
import { NextResponse } from "next/server";
import { listProjects } from "@/services/dashboard/adminProjects";

/**
 * GET /api/admin/projects
 *
 * Returns all projects with aggregated task/blocker stats.
 * Used by Super Admin Projects dashboard.
 *
 * Query params: program_id (optional filter)
 *
 * The batched aggregation lives in `services/dashboard/adminProjects`; this
 * controller keeps the capability gate and the envelope.
 */
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("projects", "view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const { status, body } = await listProjects({
      includeArchived: searchParams.get("include_archived"),
      programId: searchParams.get("program_id"),
    });
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("GET admin/projects error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
