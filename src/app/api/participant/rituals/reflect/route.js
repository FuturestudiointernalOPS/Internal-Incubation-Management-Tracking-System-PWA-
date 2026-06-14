import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");
    const weekNum = searchParams.get("week_number");

    let sql = "SELECT * FROM v2_reflections WHERE participant_id = ?";
    const args = [session.cid];
    if (programId) { sql += " AND program_id = ?"; args.push(programId); }
    if (weekNum) { sql += " AND week_number = ?"; args.push(parseInt(weekNum)); }
    sql += " ORDER BY created_at DESC";

    const res = await db.execute({ sql, args });
    return NextResponse.json({ success: true, reflections: res.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { program_id, week_number, learnings, challenges, suggestions } = await req.json();
    if (!program_id) return NextResponse.json({ success: false, error: "Program ID required" }, { status: 400 });

    await db.execute({
      sql: "INSERT INTO v2_reflections (participant_id, program_id, week_number, learnings, challenges, suggestions) VALUES (?, ?, ?, ?, ?, ?)",
      args: [session.cid, program_id, week_number || 1, learnings || "", challenges || "", suggestions || ""],
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
