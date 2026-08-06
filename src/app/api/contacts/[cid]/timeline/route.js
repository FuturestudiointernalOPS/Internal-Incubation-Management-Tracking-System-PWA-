import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

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

    if (session.role === "participant" || session.role === "founder") {
      if (session.cid !== cid) {
        return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
      }
    }

    let sql = "SELECT * FROM contact_timeline WHERE contact_cid = ?";
    const args = [cid];

    if (moduleFilter) { sql += " AND context_module = ?"; args.push(moduleFilter); }
    if (typeFilter) { sql += " AND event_type = ?"; args.push(typeFilter); }

    if (session.role === "program_manager") {
      const progRes = await db.execute({ sql: "SELECT id FROM v2_programs WHERE assigned_pm_id = ?", args: [session.cid] });
      const pmProgramIds = progRes.rows.map(r => r.id);
      if (pmProgramIds.length > 0) {
        const ph = pmProgramIds.map(() => "?").join(",");
        sql += ` AND (context_module != 'programs' OR context_id IN (${ph}))`;
        args.push(...pmProgramIds);
      } else {
        sql += " AND context_module != 'programs'";
      }
    }

    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    args.push(limit, offset);

    const result = await db.execute({ sql, args });
    const contactRes = await db.execute({ sql: "SELECT cid, name, email, role FROM contacts WHERE cid = ?", args: [cid] });

    return NextResponse.json({ success: true, contact: contactRes.rows[0] || null, events: result.rows, total: result.rows.length });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "program_manager", "staff"]);
    if (authError) return authError;

    const session = await getSession();
    const { cid } = await params;
    const { event_type, description, metadata } = await req.json();

    if (!event_type || !description) {
      return NextResponse.json({ success: false, error: "event_type and description required" }, { status: 400 });
    }

    const result = await db.execute({
      sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, actor_id, metadata)
            VALUES (?, ?, ?, 'crm', ?, ?::jsonb) RETURNING id, created_at`,
      args: [cid, event_type, description, session.cid, JSON.stringify(metadata || {})],
    });

    return NextResponse.json({ success: true, event: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
