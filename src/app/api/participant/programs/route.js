import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { getParticipantProgramIds } from "@/lib/participant-membership";

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

    const programIds = new Set(
      await getParticipantProgramIds({ cid, email, contact }),
    );

    const programs = [];
    for (const pid of Array.from(programIds)) {
      const [progRes, sesRes, delRes, subRes, attRes, kpiRes, staffRes] =
        await Promise.all([
          db.execute({
            sql: "SELECT * FROM v2_programs WHERE id::text = ?",
            args: [pid],
          }),
          db.execute({
            sql: "SELECT * FROM v2_sessions WHERE program_id::text = ? ORDER BY week_number ASC, start_at ASC",
            args: [pid],
          }),
          db.execute({
            sql: "SELECT * FROM v2_document_requirements WHERE program_id::text = ? ORDER BY created_at ASC",
            args: [pid],
          }),
          db.execute({
            sql: `SELECT s.* FROM v2_submissions s
                  WHERE s.participant_id = ? AND s.program_id::text = ?`,
            args: [cid, pid],
          }),
          db.execute({
            sql: `SELECT a.* FROM v2_attendance a
                  JOIN v2_sessions s ON a.session_id::text = s.id::text
                  WHERE a.participant_id = ? AND s.program_id::text = ?`,
            args: [cid, pid],
          }),
          db.execute({
            sql: "SELECT * FROM v2_kpis WHERE program_id::text = ?",
            args: [pid],
          }),
          db.execute({
            sql: "SELECT ps.*, c.name AS staff_name, c.role AS staff_role FROM v2_program_staff ps LEFT JOIN contacts c ON ps.staff_id::text = c.cid WHERE ps.program_id::text = ?",
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

      // ─── Determine unlocked sessions based on scheduled_date ───
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const unlockedSessions = sessions.filter((s) => {
        if (!s.scheduled_date) return true;
        const sched = new Date(s.scheduled_date);
        sched.setHours(0, 0, 0, 0);
        return sched <= today;
      });

      const unlockedSessionWeekNumbers = new Set(
        unlockedSessions.map((s) => s.week_number || 1),
      );
      const unlockedDeliverables = deliverables.filter((d) => {
        const wn = d.session_id
          ? sessions.find((s) => s.id === d.session_id)?.week_number || 1
          : d.week_number || 1;
        return unlockedSessionWeekNumbers.has(wn);
      });

      const currentWeek =
        unlockedSessions.length > 0
          ? Math.max(...unlockedSessions.map((s) => s.week_number || 1))
          : 1;

      const totalDeliverables = unlockedDeliverables.length || 1;
      const completedDeliverables = unlockedDeliverables.filter((d) =>
        submissions.some(
          (s) =>
            String(s.deliverable_id || s.document_id) === String(d.id) &&
            s.status === "approved",
        ),
      ).length;
      let percentComplete = Math.round(
        (completedDeliverables / totalDeliverables) * 100,
      );

      // Count distinct sessions with a "present" mark, restricted to unlocked
      // sessions, so duplicate attendance rows (same session recorded on
      // multiple dates) can never push the rate above 100%.
      const unlockedSessionIds = new Set(
        unlockedSessions.map((s) => String(s.id)),
      );
      const attendedSessions = new Set(
        attendance
          .filter(
            (a) =>
              a.status === "present" &&
              unlockedSessionIds.has(String(a.session_id)),
          )
          .map((a) => String(a.session_id)),
      ).size;
      // Expected attendance = sessions unlocked so far (future sessions don't count).
      const totalExpectedDays = unlockedSessions.length || 1;
      // A program "tracks" attendance only when attendance records actually exist.
      const attMetaRes = await db.execute({
        sql: "SELECT COUNT(*) AS total FROM v2_attendance WHERE program_id::text = ?",
        args: [program.id],
      });
      const attendanceTracked = parseInt(attMetaRes.rows[0]?.total || 0) > 0;
      const attendanceRate = Math.round(
        (attendedSessions / totalExpectedDays) * 100,
      );

      const approvedSubmissions = submissions.filter(
        (s) => s.status === "approved",
      ).length;
      const totalSubmissions = submissions.length || 1;
      const assignmentCompletion = Math.round(
        (approvedSubmissions / totalSubmissions) * 100,
      );

      // No deliverables tracked for this program → fall back to submissions so
      // Progress stays consistent with Assignments instead of a misleading 0%.
      if (unlockedDeliverables.length === 0 && submissions.length > 0) {
        percentComplete = assignmentCompletion;
      }

      // ─── KPI Progress — per participant ───
      // Average across the program's KPIs, where each KPI counts as "achieved"
      // only if the participant has an APPROVED submission on a deliverable
      // linked to that KPI.
      let kpiCompletion = 0;
      const approvedSubs = (submissions || []).filter(
        (s) => s.status === "approved",
      );
      const deliverableIdsByKpi = new Map();
      for (const d of deliverables || []) {
        let linkedKpiIds = [];
        try {
          linkedKpiIds =
            typeof d.kpi_ids === "string"
              ? JSON.parse(d.kpi_ids || "[]")
              : d.kpi_ids || [];
        } catch (_) {
          linkedKpiIds = [];
        }
        for (const kid of linkedKpiIds) {
          const key = String(kid);
          if (!deliverableIdsByKpi.has(key)) {
            deliverableIdsByKpi.set(key, new Set());
          }
          deliverableIdsByKpi.get(key).add(String(d.id));
        }
      }
      // Attendance counts as an extra factor in KPI achievement when the
      // program actually tracks attendance (at least one record exists).
      const kpiFactors = (kpis || []).map((kpi) => {
        const linked = deliverableIdsByKpi.get(String(kpi.id)) || new Set();
        const achieved = approvedSubs.some((s) =>
          linked.has(String(s.deliverable_id)),
        );
        return achieved ? 100 : 0;
      });
      if (attendanceTracked) kpiFactors.push(attendanceRate);
      kpiCompletion =
        kpiFactors.length > 0
          ? Math.round(
              kpiFactors.reduce((sum, v) => sum + v, 0) / kpiFactors.length,
            )
          : 0;

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
