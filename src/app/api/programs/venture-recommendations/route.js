import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * VENTURE RECOMMENDATION API (Ticket 6.4)
 *
 * GET  /api/programs/venture-recommendations?program_id=X
 *   - Returns all recommendations for a program
 *
 * GET  /api/programs/venture-recommendations?team_id=X
 *   - Returns recommendations for a specific team
 *
 * POST /api/programs/venture-recommendations
 *   - Creates a new recommendation (PM action)
 *   - Body: { program_id, team_id, team_name, reason }
 *
 * PUT /api/programs/venture-recommendations
 *   - Reviews a recommendation (admin action — approve/reject)
 *   - Body: { id, status, review_notes }
 */

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
    ]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");
    const teamId = searchParams.get("team_id");

    let sql = "SELECT * FROM venture_recommendations";
    const args = [];
    const conditions = [];

    if (programId) {
      conditions.push("program_id = ?");
      args.push(programId);
    }
    if (teamId) {
      conditions.push("team_id = ?");
      args.push(teamId);
    }
    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY created_at DESC";

    const result = await db.execute({ sql, args });
    return NextResponse.json({ success: true, recommendations: result.rows });
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
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
    ]);
    if (authError) return authError;

    const { program_id, team_id, team_name, reason } = await req.json();

    if (!program_id || !team_id) {
      return NextResponse.json(
        { success: false, error: "program_id and team_id are required" },
        { status: 400 },
      );
    }

    // Get recommender name
    let recommenderName = session.cid;
    try {
      const userRes = await db.execute({
        sql: "SELECT name FROM contacts WHERE cid = ?",
        args: [session.cid],
      });
      if (userRes.rows.length > 0) recommenderName = userRes.rows[0].name;
    } catch (_) {}

    const result = await db.execute({
      sql: `INSERT INTO venture_recommendations
            (program_id, team_id, team_name, recommended_by, recommended_by_name, reason)
            VALUES (?, ?, ?, ?, ?, ?)
            RETURNING *`,
      args: [program_id, team_id, team_name || null, session.cid, recommenderName, reason || null],
    });

    return NextResponse.json({ success: true, recommendation: result.rows[0] });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }
    // Only super_admin can review (approve/reject)
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const { id, status, review_notes } = await req.json();

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: "id and status are required" },
        { status: 400 },
      );
    }

    if (!["pending", "under_review", "approved", "rejected"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "Invalid status" },
        { status: 400 },
      );
    }

    // Get reviewer name
    let reviewerName = session.cid;
    try {
      const userRes = await db.execute({
        sql: "SELECT name FROM contacts WHERE cid = ?",
        args: [session.cid],
      });
      if (userRes.rows.length > 0) reviewerName = userRes.rows[0].name;
    } catch (_) {}

    const result = await db.execute({
      sql: `UPDATE venture_recommendations
            SET status = ?, reviewed_by = ?, reviewed_by_name = ?, review_notes = ?, reviewed_at = NOW()
            WHERE id = ?
            RETURNING *`,
      args: [status, session.cid, reviewerName, review_notes || null, id],
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Recommendation not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, recommendation: result.rows[0] });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
