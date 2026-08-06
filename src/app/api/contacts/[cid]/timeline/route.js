import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/contacts/[cid]/timeline
 *
 * Returns the contact_timeline for a specific contact, scoped by role:
 * - super_admin: all events
 * - program_manager: program-scoped events only
 * - participant/founder: own events only
 * - staff/teacher: limited view
 *
 * Query params:
 *   module  — filter by context_module (forms, programs, ventures, etc.)
 *   type    — filter by event_type
 *   limit   — max events (default 50)
 *   offset  — for pagination
 */
export async function GET(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff", "super_admin", "program_manager", "teacher", "participant", "founder",
    ]);
    if (authError) return authError;

    const session = await getSession();
    const { cid } = await params;
    const { searchParams } = new URL(req.url);
    const moduleFilter = searchParams.get("module");
    const typeFilter = searchParams.get("type");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Role-based scoping
    if (session.role === "participant" || session.role === "founder") {
      // Can only see own timeline
      if (session.cid !== cid) {
        return NextResponse.json(
          { success: false, error: "Access denied" },
          { status: 403 },
        );
      }
    }

    let sql = "SELECT * FROM contact_timeline WHERE contact_cid = ?";
    const args = [cid];

    if (moduleFilter) {
      sql += " AND context_module = ?";
      args.push(moduleFilter);
    }

    if (typeFilter) {
      sql += " AND event_type = ?";
      args.push(typeFilter);
    }

    // PM sees only program-scoped events
    if (session.role === "program_manager") {
      // Get PM's assigned programs
      const progRes = await db.execute({
        sql: "SELECT id FROM v2_programs WHERE assigned_pm_id = ?",
        args: [session.cid],
      });
      const pmProgramIds = progRes.rows.map((r) => r.id);

      if (pmProgramIds.length > 0) {
        const placeholders = pmProgramIds.map(() => "?").join(",");
        sql += ` AND (context_module != 'programs' OR context_id IN (${placeholders}))`;
        args.push(...pmProgramIds);
      } else {
        // PM with no assigned programs — only non-program events
        sql += " AND context_module != 'programs'";
      }
    }

    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    args.push(limit, offset);

    const result = await db.execute({ sql, args });

    // Get contact summary for header
    const contactRes = await db.execute({
      sql: "SELECT cid, name, email, role FROM contacts WHERE cid = ?",
      args: [cid],
    });

    return NextResponse.json({
      success: true,
      contact: contactRes.rows[0] || null,
      events: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error("Timeline API error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
