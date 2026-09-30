import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { initDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { listVenturesAssignedToStaff } from "@/models/ventureWorkspace";

/**
 * GET /api/ventures/assigned[?venture=VNT-XXXX]
 *
 * My Venture assignments (delegated staff) — the "My Ventures" list for the
 * staff console. Access is derived from the caller's own active assignment
 * rows only; never from the global role. Super Admin/global roles use the
 * admin console instead and receive an empty list here.
 */
export const GET = createHandler(
  { roles: ["staff", "program_manager", "super_admin"] },
  async (req) => {
    await initDb();
    const session = await getSession();
    if (!session?.cid) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });

    // Global Venture authority uses /admin — this endpoint is for delegated staff.
    if (["super_admin"].includes(session.role)) {
      return NextResponse.json({ success: true, assignments: [] });
    }

    const { searchParams } = new URL(req.url);
    const ventureFilter = searchParams.get("venture");

    const result = await listVenturesAssignedToStaff(session.cid, ventureFilter);
    return NextResponse.json({ success: true, assignments: result.rows || [] });
  },
);
