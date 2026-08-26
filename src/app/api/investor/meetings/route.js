import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";

/** GET /api/investor/meetings?venture_id=X */
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("investor", "view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const ventureId = searchParams.get("venture_id");

    let sql = `SELECT e.*, p.name as venture_name
               FROM v2_events e
               LEFT JOIN v2_programs p ON e.program_id = p.id
               WHERE e.event_type = 'investor_meeting'`;
    const args = [];

    if (ventureId) {
      sql += " AND e.program_id = ?";
      args.push(ventureId);
    }

    sql += " ORDER BY e.start_time DESC";

    const result = await db.execute({ sql, args });
    return NextResponse.json({ success: true, meetings: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** POST /api/investor/meetings — schedule */
export async function POST(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("investor", "create");
    if (capError) return capError;

    const session = await getSession();
    const { venture_id, title, description, start_time, end_time, location } = await req.json();

    if (!title || !start_time) {
      return NextResponse.json({ success: false, error: "Title and start_time required" }, { status: 400 });
    }

    const result = await db.execute({
      sql: `INSERT INTO v2_events (program_id, title, description, event_type, start_time, end_time, location, created_by)
            VALUES (?, ?, ?, 'investor_meeting', ?, ?, ?, ?) RETURNING *`,
      args: [venture_id || null, title, description || null, start_time, end_time || null, location || "video", session.cid || session.id],
    });

    return NextResponse.json({ success: true, meeting: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
