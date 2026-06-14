import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

async function resolveCid(req) {
  const { searchParams } = new URL(req.url);
  let cid = searchParams.get("cid");
  if (!cid) {
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (session) cid = session.cid;
  }
  return cid;
}

/**
 * RETROSPECTIVE API — SUSPENDED
 *
 * This endpoint is intentionally disabled from the participant UI.
 * Do not re-enable without explicit approval from the product owner.
 */

export async function GET(req) {
  try {
    await initDb();
    const cid = await resolveCid(req);
    if (!cid)
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );

    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");
    const weekNum = searchParams.get("week_number");

    let sql = "SELECT * FROM v2_retros WHERE participant_id = ?";
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
    return NextResponse.json({ success: true, retros: res.rows });
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
    const cid = await resolveCid(req);
    if (!cid)
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    const { program_id, week_number, went_well, improve, action_items } =
      await req.json();
    if (!program_id)
      return NextResponse.json(
        { success: false, error: "Program ID required" },
        { status: 400 },
      );

    await db.execute({
      sql: "INSERT INTO v2_retros (participant_id, program_id, week_number, went_well, improve, action_items) VALUES (?, ?, ?, ?, ?, ?)",
      args: [
        cid,
        program_id,
        week_number || 1,
        went_well || "",
        improve || "",
        action_items || "",
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
