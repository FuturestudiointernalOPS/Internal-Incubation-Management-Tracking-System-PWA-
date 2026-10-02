import { initDb } from "@/lib/db";
import { requireProjectAccess } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getProjectDetail } from "@/services/dashboard/adminProjects";

/**
 * GET /api/admin/projects/[id]
 *
 * Returns a single project with:
 *   - Project details + owner + program name
 *   - Task stats + full task list
 *   - Blocker list
 *   - Team members
 *   - Activity timeline
 *
 * The assembly lives in `services/dashboard/adminProjects`; this controller
 * keeps `initDb`, the project-scope guard and the envelope.
 */
export async function GET(req, { params }) {
  try {
    await initDb();
    const { id } = await params;
    const authError = await requireProjectAccess(id);
    if (authError) return authError;

    const { status, body } = await getProjectDetail(id);
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("GET admin/projects/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
