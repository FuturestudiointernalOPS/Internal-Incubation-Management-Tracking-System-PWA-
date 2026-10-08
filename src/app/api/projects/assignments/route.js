import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { listProjectAssignments } from "@/services/projects/collaboration";

/**
 * PROJECT ASSIGNMENTS API — controller layer.
 *
 * GET /api/projects/assignments?user_cid=X
 *
 * Returns projects grouped by relationship to the user:
 *   owned:     projects where owner_id = user
 *   collab:    projects where user is in project_members
 *   all_active: all active projects (for dropdown)
 *
 * The scope rule, the fail-open reads and the deduplication live in
 * `@/services/projects/collaboration`.
 */
export const GET = createHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const { getSession } = await import("@/server/auth/session");
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );
  }

  const result = await listProjectAssignments({
    role: session.role,
    sessionCid: session.cid,
    requestedCid: searchParams.get("user_cid"),
  });

  if (result.error) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({
    success: true,
    owned: result.owned,
    collab: result.collab,
    myProjects: result.myProjects,
    all_active: result.all_active,
  });
});
