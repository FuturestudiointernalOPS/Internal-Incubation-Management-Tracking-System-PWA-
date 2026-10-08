import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { requireProjectAccess } from "@/server/authz/guards";
import { generateProjectReport } from "@/services/dashboard/adminProjectReports";

/**
 * POST /api/admin/projects/[id]/reports/generate
 *
 * Composes and stores the week's auto-generated narrative for a project. The
 * composition and the upsert live in
 * `services/dashboard/adminProjectReports`; this controller keeps `initDb`, the
 * role check, the project-scope guard and the envelope.
 */
export async function POST(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "staff", "program_manager"]);
    if (authError) return authError;
    const { id } = await params;

    // Object-level scope: the project id comes from the URL, and the sibling
    // admin project surfaces all require membership. Without this, any staff or
    // PM could write a weekly report onto a project they do not belong to.
    const accessError = await requireProjectAccess(id);
    if (accessError) return accessError;

    const { status, body } = await generateProjectReport(id);
    return NextResponse.json(body, { status });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
