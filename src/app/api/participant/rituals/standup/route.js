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
    if (!session)
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );

    const { searchParams } = new URL(req.url);
    let cid = searchParams.get("cid");
    if (!cid) cid = session.cid;
    const programId = searchParams.get("program_id");
    const weekNum = searchParams.get("week_number");

    let sql = "SELECT * FROM v2_standups WHERE participant_id = ?";
    const args = [cid];
    if (programId) {
      sql += " AND program_id = ?";
      args.push(programId);
    }
    if (weekNum) {
      sql += " AND week_number = ?";
      args.push(parseInt(weekNum));
    }
    sql += " ORDER BY created_at DESC";

    const res = await db.execute({ sql, args });
    return NextResponse.json({ success: true, standups: res.rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session)
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );

    const { searchParams } = new URL(req.url);
    let cid = searchParams.get("cid");
    if (!cid) cid = session.cid;
    const { program_id, week_number, what_done, what_today, blockers } =
      await req.json();
    if (!program_id)
      return NextResponse.json(
        { success: false, error: "Program ID required" },
        { status: 400 },
      );

    await db.execute({
      sql: "INSERT INTO v2_standups (participant_id, program_id, week_number, what_done, what_today, blockers) VALUES (?, ?, ?, ?, ?, ?)",
      args: [
        cid,
        program_id,
        week_number || 1,
        what_done || "",
        what_today || "",
        blockers || "",
      ],
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
