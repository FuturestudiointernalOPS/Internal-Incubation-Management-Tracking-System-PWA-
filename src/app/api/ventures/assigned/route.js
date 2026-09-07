import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db, { initDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

/**
 * GET /api/ventures/assigned[?venture=VNT-XXXX]
 *
 * My Venture assignments (delegated staff) — the "My Ventures" list for the
 * staff console. Access is derived from the caller's own active assignment
 * rows only; never from the global role. Super Admin/global roles use the
 * admin console instead and receive an empty list here.
 */
export const GET = createHandler(
  { roles: ["staff", "program_manager", "super_admin", "developer", "admin", "teacher"] },
  async (req) => {
    await initDb();
    const session = await getSession();
    if (!session?.cid) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });

    // Global Venture authority uses /admin — this endpoint is for delegated staff.
    if (["super_admin", "developer", "admin"].includes(session.role)) {
      return NextResponse.json({ success: true, assignments: [] });
    }

    const { searchParams } = new URL(req.url);
    const ventureFilter = searchParams.get("venture");

    let sql = `
      SELECT a.id, a.responsibility_code, vr.name AS responsibility_name,
             a.scope_type, a.scope_ref_type, a.scope_ref_id, a.notes, a.created_at AS assigned_at,
             v.venture_id, v.company_name, v.name, v.status, v.business_stage, v.industry, v.country
      FROM venture_staff_assignments a
      JOIN ventures v ON v.venture_id = a.venture_id
      LEFT JOIN venture_responsibilities vr ON vr.code = a.responsibility_code
      WHERE a.staff_contact_id = ? AND a.status = 'active'
    `;
    const args = [session.cid];
    if (ventureFilter) {
      sql += " AND a.venture_id = ?";
      args.push(ventureFilter);
    }
    sql += " ORDER BY v.company_name NULLS LAST, v.name NULLS LAST, a.id DESC";

    const r = await db.execute({ sql, args });
    return NextResponse.json({ success: true, assignments: r.rows || [] });
  },
);
