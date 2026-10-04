import { initDb } from "@/lib/db";
import { requireProjectAccess } from "@/server/authz/guards";
import { NextResponse } from "next/server";
import {
  listProjectUpdates,
  saveProjectUpdate,
} from "@/services/dashboard/adminProjectUpdates";

/**
 * PROJECT UPDATES API
 *
 * GET  /api/admin/projects/[id]/updates
 *   - Returns all weekly updates for a project, newest first
 *
 * POST /api/admin/projects/[id]/updates
 *   - Creates or updates a weekly narrative (upsert on project_id + week + year)
 *
 * Body (POST):
 *   user_id, user_name, week_number, year, status,
 *   accomplishments, current_focus, blockers, next_steps,
 *   overall_status, notes
 *
 * The upsert lives in `services/dashboard/adminProjectUpdates`; this controller
 * keeps `initDb`, the project-scope guard and the envelope.
 */

export async function GET(req, { params }) {
  try {
    await initDb();
    const { id } = await params;
    const authError = await requireProjectAccess(id);
    if (authError) return authError;

    const { status, body } = await listProjectUpdates(id);
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("GET project updates error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req, { params }) {
  try {
    await initDb();
    const { id } = await params;
    const authError = await requireProjectAccess(id);
    if (authError) return authError;

    const payload = await req.json();
    const { status, body } = await saveProjectUpdate({ projectId: id, payload });
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("POST project updates error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
