import { initDb } from "@/lib/db";
import db from "@/lib/db";
import { NextResponse } from "next/server";
import {
  requireAuth,
  getSession,
  requireProgramFacilitator,
} from "@/lib/auth";

/**
 * FACILITATOR REVIEWS API
 * -----------------------------------------------------------------------------
 * Facilitators submit reviews to the Program Manager. The PM records a
 * decision/action on the same row — the original review text is preserved
 * (audit trail) and never rewritten by the PM.
 *
 * GET  /api/facilitator-reviews?program_id=...      (PM / super_admin / staff)
 * GET  /api/facilitator-reviews?facilitator_id=...  (facilitator sees own)
 * POST /api/facilitator-reviews                     (facilitator / PM / SA)
 * PUT  /api/facilitator-reviews                     (PM decision — SA / PM / staff)
 */

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "super_admin",
      "program_manager",
      "staff",
      "teacher",
      "facilitator",
    ]);
    if (authError) return authError;

    const session = await getSession();
    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");
    const facilitatorId = searchParams.get("facilitator_id");
    const weekNumber = searchParams.get("week_number");

    let sql = "SELECT * FROM program_facilitator_reviews WHERE 1=1";
    const args = [];

    if (programId) {
      sql += " AND CAST(program_id AS TEXT) = ?";
      args.push(String(programId));
    }
    if (facilitatorId) {
      sql += " AND facilitator_id = ?";
      args.push(facilitatorId);
    }
    if (weekNumber) {
      sql += " AND week_number = ?";
      args.push(parseInt(weekNumber));
    }

    // Facilitators may only read their own reviews
    if (session.role === "facilitator") {
      sql += " AND facilitator_id = ?";
      args.push(session.cid);
    }

    sql += " ORDER BY created_at DESC";
    const res = await db.execute({ sql, args });
    return NextResponse.json({ success: true, reviews: res.rows });
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
    const authError = await requireAuth([
      "super_admin",
      "program_manager",
      "staff",
      "facilitator",
    ]);
    if (authError) return authError;

    const session = await getSession();
    const body = await req.json();
    const {
      program_id,
      week_number,
      participant_progress,
      attendance_concerns,
      assignment_performance,
      challenges,
      participants_needing_intervention,
      completed_work,
      needs_attention,
      recommendations,
    } = body;

    if (!program_id) {
      return NextResponse.json(
        { success: false, error: "program_id is required" },
        { status: 400 },
      );
    }

    // Enforce program assignment for facilitators
    if (session.role === "facilitator") {
      const guardError = await requireProgramFacilitator(program_id);
      if (guardError) return guardError;
    }

    const result = await db.execute({
      sql: `INSERT INTO program_facilitator_reviews (
        program_id, facilitator_id, facilitator_name, week_number,
        participant_progress, attendance_concerns, assignment_performance,
        challenges, participants_needing_intervention, completed_work,
        needs_attention, recommendations, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted') RETURNING id`,
      args: [
        program_id,
        session.cid || "unknown",
        session.name || null,
        week_number ? parseInt(week_number) : null,
        participant_progress || null,
        attendance_concerns || null,
        assignment_performance || null,
        challenges || null,
        participants_needing_intervention || null,
        completed_work || null,
        needs_attention || null,
        recommendations || null,
      ],
    });

    return NextResponse.json({
      success: true,
      reviewId: result.rows[0]?.id ?? result.lastInsertRowid,
    });
  } catch (error) {
    console.error("Facilitator review POST error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "super_admin",
      "program_manager",
      "staff",
    ]);
    if (authError) return authError;

    const session = await getSession();
    const body = await req.json();
    const { id, pm_decision, pm_decision_note } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 },
      );
    }

    // PMs can only decide on reviews for programs they manage (or SA/staff)
    if (session.role === "program_manager") {
      const review = await db.execute({
        sql: "SELECT program_id FROM program_facilitator_reviews WHERE id = ?",
        args: [id],
      });
      const progId = review.rows[0]?.program_id;
      if (progId) {
        const prog = await db.execute({
          sql: "SELECT assigned_pm_id FROM v2_programs WHERE id = ?",
          args: [progId],
        });
        if (prog.rows[0]?.assigned_pm_id !== session.cid) {
          return NextResponse.json(
            { success: false, error: "errors.insufficientPermissions" },
            { status: 403 },
          );
        }
      }
    }

    await db.execute({
      sql: `UPDATE program_facilitator_reviews SET
              pm_decision = ?,
              pm_decision_note = ?,
              pm_decision_by = ?,
              pm_decision_at = NOW(),
              status = 'decided',
              updated_at = NOW()
            WHERE id = ?`,
      args: [
        pm_decision || null,
        pm_decision_note || null,
        session.cid || null,
        id,
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
