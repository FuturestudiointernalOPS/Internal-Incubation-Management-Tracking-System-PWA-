import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * PARTICIPANT PROGRAMS API
 * Returns ALL programs a participant is enrolled in.
 * Supports multi-program enrollment (LMS-style).
 */
export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email required" },
        { status: 400 },
      );
    }

    // 1. Find the participant's contact record
    const userRes = await db.execute({
      sql: "SELECT cid, program_id, program_name, group_name FROM contacts WHERE email = ?",
      args: [email],
    });

    if (userRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Participant not found" },
        { status: 404 },
      );
    }

    const contact = userRes.rows[0];
    const cid = contact.cid;

    // 2. Find all program IDs this participant is linked to
    //    - Via contacts.program_id (direct enrollment)
    //    - Via contacts.group_name matching families.name → families.program_id
    //    - Via contacts.group_name matching v2_programs.name (direct match)
    //    - Via v2_participants table (legacy enrollment)
    const programIds = new Set();

    if (contact.program_id != null) {
      // Safely convert to string in case PostgreSQL returns a number
      const raw = String(contact.program_id);
      // Handle comma-separated multiple program IDs
      raw
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .forEach((id) => programIds.add(id));
    }

    // Check group_name via families table (group → program link)
    if (contact.group_name) {
      const familyRes = await db.execute({
        sql: "SELECT program_id FROM families WHERE UPPER(TRIM(name)) = UPPER(TRIM(?)) AND program_id IS NOT NULL",
        args: [contact.group_name],
      });
      familyRes.rows.forEach((r) => {
        if (r.program_id != null) programIds.add(String(r.program_id).trim());
      });

      // Also check direct program name match (legacy)
      const groupRes = await db.execute({
        sql: "SELECT id FROM v2_programs WHERE UPPER(TRIM(name)) = UPPER(TRIM(?))",
        args: [contact.group_name],
      });
      groupRes.rows.forEach((r) => {
        if (r.id != null) programIds.add(String(r.id).trim());
      });
    }

    // Also check v2_participants table for this email
    const legacyRes = await db.execute({
      sql: "SELECT program_id FROM v2_participants WHERE email = ?",
      args: [email],
    });
    legacyRes.rows.forEach((r) => {
      if (r.program_id != null) programIds.add(String(r.program_id).trim());
    });

    // 3. Fetch all programs with their data
    const programs = [];
    const programIdList = Array.from(programIds);

    for (const pid of programIdList) {
      // Use parallel queries per program
      const [progRes, sesRes, delRes, subRes, folRes] = await Promise.all([
        db.execute({
          sql: "SELECT * FROM v2_programs WHERE id = ?",
          args: [pid],
        }),
        db.execute({
          sql: "SELECT * FROM v2_sessions WHERE program_id = ? ORDER BY week_number ASC",
          args: [pid],
        }),
        db.execute({
          sql: "SELECT * FROM v2_deliverables WHERE program_id = ? ORDER BY week_number ASC",
          args: [pid],
        }),
        db.execute({
          sql: "SELECT * FROM v2_submissions WHERE participant_id = ? AND program_id = ?",
          args: [cid, pid],
        }),
        db.execute({
          sql: "SELECT * FROM v2_followups WHERE program_id = ? ORDER BY created_at DESC LIMIT 5",
          args: [pid],
        }),
      ]);

      const program = progRes.rows[0];
      if (!program) continue;

      // Calculate completion metrics
      const sessions = sesRes.rows || [];
      const submissions = subRes.rows || [];
      const deliverables = delRes.rows || [];
      const currentWeek = program.duration_weeks
        ? Math.min(
            Math.max(
              ...sessions
                .filter((s) => s.status !== "locked")
                .map((s) => s.week_number || 1),
              1,
            ),
            program.duration_weeks,
          )
        : 1;

      const totalSteps = deliverables.length || 1;
      const completedSteps = deliverables.filter((d) => {
        const sub = submissions.find((s) => s.deliverable_id === d.id);
        return sub && (sub.status === "approved" || sub.status === "completed");
      }).length;
      const percentComplete = Math.round((completedSteps / totalSteps) * 100);

      programs.push({
        ...program,
        sessions,
        deliverables,
        submissions,
        followups: folRes.rows || [],
        metrics: {
          currentWeek,
          percentComplete,
          totalDeliverables: deliverables.length,
          completedDeliverables: completedSteps,
        },
      });
    }

    return NextResponse.json({
      success: true,
      programs,
      count: programs.length,
      contact,
    });
  } catch (error) {
    console.error("Participant Programs Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
