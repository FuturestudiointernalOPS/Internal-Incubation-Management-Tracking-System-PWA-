import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

export const dynamic = "force-dynamic";

/**
 * RETROSPECTIVE API — SUSPENDED
 * This endpoint is intentionally disabled from the participant UI.
 * Do not re-enable without explicit approval from the product owner.
 */

export const GET = createHandler(async (req) => {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  const cid = session.cid;
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
});

export const POST = createHandler(async (req) => {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  const cid = session.cid;
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
});
