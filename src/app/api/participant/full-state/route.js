import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const groupName = searchParams.get("group_name");

    const session = await getSession();
    if (!session)
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    if (
      !["super_admin", "staff", "program_manager", "teacher"].includes(session.role) &&
      String(session.email || "").toLowerCase() !== String(email || "").trim().toLowerCase()
    ) {
      return NextResponse.json(
        { success: false, error: "You can only access your own data." },
        { status: 403 },
      );
    }

    if (!email || !groupName)
      return NextResponse.json({
        success: false,
        error: "Email and Group Name required",
      });

    // 1. Get Participant CID
    const userRes = await db.execute({
      sql: "SELECT cid FROM contacts WHERE email = ?",
      args: [email],
    });
    const cid = userRes.rows.length > 0 ? userRes.rows[0].cid : email;

    // Parallel Cluster Fetch
    const [
      progRes,
      subRes,
      sesRes,
      notRes,
      kpiRes,
      docRes,
      folRes,
      teamRes,
      familyRes,
    ] = await Promise.all([
      db.execute({
        sql: "SELECT * FROM v2_programs WHERE name = ?",
        args: [groupName],
      }),
      db.execute({
        sql: "SELECT * FROM v2_submissions WHERE participant_id::text = ?",
        args: [cid],
      }),
      db.execute({
        sql: "SELECT * FROM v2_sessions WHERE program_id = ?",
        args: [groupName],
      }),
      db.execute({
        sql: "SELECT * FROM v2_notifications WHERE recipient_id = ? ORDER BY created_at DESC",
        args: [email],
      }),
      db.execute({
        sql: "SELECT * FROM v2_kpis WHERE program_id = ?",
        args: [groupName],
      }),
      db.execute({
        sql: "SELECT * FROM v2_document_requirements WHERE program_id = ?",
        args: [groupName],
      }),
      db.execute({
        sql: "SELECT * FROM v2_followups WHERE program_id = ? ORDER BY created_at DESC LIMIT 3",
        args: [groupName],
      }),
      db.execute({
        sql: "SELECT t.* FROM v2_teams t JOIN contacts c ON c.cid = t.handler_id WHERE UPPER(TRIM(c.group_name)) = UPPER(TRIM(?)) LIMIT 1",
        args: [groupName],
      }),
      db.execute({
        sql: "SELECT * FROM families WHERE name = ?",
        args: [groupName],
      }).catch(() => ({ rows: [] })),
    ]);

    // Aggregate Grading
    const submissions = subRes.rows;
    let individualScore = 0;
    submissions.forEach((s) => {
      individualScore += parseInt(s.score || s.grade) || 0;
    });
    const groupScore = 0; // group_score column not yet available on families
    const finalGrade = individualScore + groupScore;

    return NextResponse.json({
      success: true,
      program: progRes.rows[0],
      submissions: submissions,
      sessions: sesRes.rows,
      notifications: notRes.rows,
      kpis: kpiRes.rows,
      documents: docRes.rows,
      followups: folRes.rows,
      team: teamRes.rows[0],
      grades: { individualScore, groupScore, finalGrade },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
