import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";

export async function GET(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("investor", "view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const ventureId = searchParams.get("venture_id");
    if (!ventureId) return NextResponse.json({ success: false, error: "venture_id required" }, { status: 400 });

    const result = await db.execute({
      sql: "SELECT * FROM venture_updates WHERE venture_id = ? ORDER BY created_at DESC",
      args: [ventureId],
    });
    return NextResponse.json({ success: true, updates: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("investor", "create");
    if (capError) return capError;

    const session = await getSession();
    const { venture_id, title, content, update_type } = await req.json();
    if (!venture_id || !title || !content) {
      return NextResponse.json({ success: false, error: "venture_id, title, and content required" }, { status: 400 });
    }

    const result = await db.execute({
      sql: "INSERT INTO venture_updates (venture_id, title, content, update_type, created_by) VALUES (?, ?, ?, ?, ?) RETURNING *",
      args: [venture_id, title, content, update_type || "general", session.cid || session.id],
    });
    return NextResponse.json({ success: true, update: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
