import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * RETROSPECTIVE API — SUSPENDED
 *
 * This endpoint is intentionally disabled from the participant UI.
 * The retro feature was removed from the frontend RITUAL_TYPES array
 * in RitualsView.js pending UX review.
 *
 * DO NOT re-enable without explicit approval from the product owner.
 * If re-enabling, also restore:
 *   - The retro entry in RITUAL_TYPES (RitualsView.js)
 *   - The retro fieldConfig (RitualsView.js)
 *   - Retro participation in the metrics calculation
 *
 * This API still works if called directly, but no participant-facing
 * UI exposes it. Remove or restore this endpoint as decided.
 */

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
    const programId = searchParams.get("program_id");
    const weekNum = searchParams.get("week_number");

    let sql = "SELECT * FROM v2_retros WHERE participant_id = ?";
    const args = [session.cid];
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
    const authError = await requireAuth();
    if (authError) return authError;
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session)
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
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
        session.cid,
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
