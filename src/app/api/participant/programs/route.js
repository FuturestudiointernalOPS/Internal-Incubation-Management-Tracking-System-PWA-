import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const cid = session.cid;
    const email = session.email;
    const headers = {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    };

    const userRes = await db.execute({
      sql: "SELECT cid, name, email, program_id, program_name, group_name FROM contacts WHERE cid = ?",
      args: [cid],
    });
    if (userRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Participant not found" },
        { status: 404, headers },
      );
    }
    const contact = userRes.rows[0];

    const programIds = new Set();
    if (contact.program_id) {
      String(contact.program_id)
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .forEach((id) => programIds.add(id));
    }
    if (contact.group_name) {
      const familyRes = await db.execute({
        sql: "SELECT program_id FROM families WHERE UPPER(TRIM(name)) = UPPER(TRIM(?)) AND program_id IS NOT NULL",
        args: [contact.group_name],
      });
      familyRes.rows.forEach((r) => {
        if (r.program_id) programIds.add(String(r.program_id).trim());
      });
      const groupRes = await db.execute({
        sql: "SELECT id FROM v2_programs WHERE UPPER(TRIM(name)) = UPPER(TRIM(?))",
        args: [contact.group_name],
      });
      groupRes.rows.forEach((r) => {
        if (r.id) programIds.add(String(r.id).trim());
      });
    }

    const programs = [];
    for (const pid of Array.from(programIds)) {
      const [progRes, sesRes, delRes, subRes, attRes, kpiRes, staffRes] =
        await Promise.all([
          db.execute({
            sql: "SELECT * FROM v2_programs WHERE id = ?",
            args: [pid],
          }),
          db.execute({
            sql: "SELECT * FROM v2_sessions WHERE program_id = ? ORDER BY week_number ASC, start_at ASC",
            args: [pid],
          }),
          db.execute({
            sql: "SELECT * FROM v2_document_requirements WHERE program_id = ? ORDER BY created_at ASC",
            args: [pid],
          }),
          db.execute({
            sql: "SELECT * FROM v2_submissions WHERE participant_id = ? AND program_id = ?",
            args: [cid, pid],
          }),
          db.execute({
            sql: "SELECT * FROM v2_attendance WHERE participant_id = ? AND program_id = ?",
            args: [cid, pid],
          }),
          db.execute({
            sql: "SELECT * FROM v2_kpis WHERE program_id = ?",
            args: [pid],
          }),
          db.execute({
            sql: "SELECT ps.*, c.name AS staff_name, c.role AS staff_role FROM v2_program_staff ps LEFT JOIN contacts c ON ps.staff_id = c.cid WHERE ps.program_id = ?",
            args: [pid],
          }),
        ]);

      const program = progRes.rows[0];
      if (!program) continue;

      const sessions = sesRes.rows || [];
      const submissions = subRes.rows || [];
      const deliverables = delRes.rows || [];
      const attendance = attRes.rows || [];
      const kpis = kpiRes.rows || [];

      const unlockedSessions = sessions.filter((s) => s.status !== "locked");
      const maxCompletedWeek =
        unlockedSessions.length > 0
          ? Math.max(...unlockedSessions.map((s) => s.week_number || 1))
          : 0;
      const currentWeek = program.duration_weeks
        ? Math.min(Math.max(maxCompletedWeek, 1), program.duration_weeks)
        : 1;

      const totalDeliverables = deliverables.length || 1;
      const completedDeliverables = deliverables.filter((d) =>
        submissions.some(
          (s) => s.document_id === d.id && s.status === "approved",
        ),
      ).length;
      const percentComplete = Math.round(
        (completedDeliverables / totalDeliverables) * 100,
      );

      const attendedSessions = attendance.filter(
        (a) => a.status === "present",
      ).length;
      const totalSessionCount = sessions.length || 1;
      const attendanceRate = Math.round(
        (attendedSessions / totalSessionCount) * 100,
      );

      const approvedSubmissions = submissions.filter(
        (s) => s.status === "approved",
      ).length;
      const totalSubmissions = submissions.length || 1;
      const assignmentCompletion = Math.round(
        (approvedSubmissions / totalSubmissions) * 100,
      );

      const targetMetKpis = kpis.filter((k) => {
        const t = parseInt(k.target_value) || 0;
        const c = parseInt(k.current_value) || 0;
        return c >= t;
      }).length;
      const totalKpis = kpis.length || 1;
      const kpiCompletion = Math.round((targetMetKpis / totalKpis) * 100);

      const facilitators = (staffRes.rows || []).map((s) => ({
        id: s.staff_id,
        name: s.staff_name || s.staff_id,
        role: s.role,
      }));
      let pmName = null;
      if (program.assigned_pm_id) {
        const pmRes = await db.execute({
          sql: "SELECT name FROM contacts WHERE cid = ?",
          args: [program.assigned_pm_id],
        });
        if (pmRes.rows.length > 0) pmName = pmRes.rows[0].name;
      }

      programs.push({
        id: program.id,
        name: program.name,
        description: program.description,
        status: program.status,
        startDate: program.start_date,
        endDate: program.end_date,
        durationWeeks: program.duration_weeks,
        currentWeek,
        cohort: contact.group_name || "Cohort 1",
        programMode: program.program_mode,
        facilitators,
        pmName,
        metrics: {
          percentComplete,
          attendanceRate,
          assignmentCompletion,
          kpiCompletion,
          currentWeek,
          totalDeliverables,
          completedDeliverables,
          totalSessions: sessions.length,
          attendedSessions,
        },
        sessionCount: sessions.length,
        deliverableCount: deliverables.length,
        unlockedSessionCount: unlockedSessions.length,
      });
    }

    return NextResponse.json(
      {
        success: true,
        programs,
        count: programs.length,
        contact: {
          cid: contact.cid,
          name: contact.name,
          email: contact.email,
          groupName: contact.group_name,
        },
      },
      { headers },
    );
  } catch (error) {
    console.error("Participant Programs Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
