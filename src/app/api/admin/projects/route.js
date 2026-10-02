import { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
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
 * controller keeps the authentication and the envelope.
 */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

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
