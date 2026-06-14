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

export async function GET(req) {
  try {
    await initDb();
    const cid = await resolveCid(req);
    if (!cid)
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );

    const contactRes = await db.execute({
      sql: "SELECT cid, name, email, program_id, group_name FROM contacts WHERE cid = ?",
      args: [cid],
    });
    if (contactRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Participant not found" },
        { status: 404 },
      );
    }
    const contact = contactRes.rows[0];

    // Find program IDs
    const programIds = new Set();
    if (contact.program_id) {
      String(contact.program_id)
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .forEach((id) => programIds.add(id));
    }
    if (contact.group_name) {
      const [famRes, grpRes] = await Promise.all([
        db.execute({
          sql: "SELECT program_id FROM families WHERE UPPER(TRIM(name)) = UPPER(TRIM(?)) AND program_id IS NOT NULL",
          args: [contact.group_name],
        }),
        db.execute({
          sql: "SELECT id FROM v2_programs WHERE UPPER(TRIM(name)) = UPPER(TRIM(?))",
          args: [contact.group_name],
        }),
      ]);
      famRes.rows.forEach((r) => {
        if (r.program_id) programIds.add(String(r.program_id).trim());
      });
      grpRes.rows.forEach((r) => {
        if (r.id) programIds.add(String(r.id).trim());
      });
    }

    const programIdList = Array.from(programIds);
    const programsData = [];
    let overallSubmissions = 0,
      overallApproved = 0,
      overallSessions = 0,
      overallAttended = 0;
    let overallKpis = 0,
      overallKpisMet = 0,
      overallDeliverables = 0,
      overallCompletedDels = 0;
    let totalStandups = 0,
      totalCheckins = 0,
      totalRetros = 0,
      totalReflections = 0;

    for (const pid of programIdList) {
      const [
        progRes,
        sesRes,
        delRes,
        subRes,
        attRes,
        kpiRes,
        standupRes,
        checkinRes,
        retroRes,
        reflectRes,
      ] = await Promise.all([
        db.execute({
          sql: "SELECT * FROM v2_programs WHERE id = ?",
          args: [pid],
        }),
        db.execute({
          sql: "SELECT * FROM v2_sessions WHERE program_id = ? ORDER BY week_number ASC",
          args: [pid],
        }),
        db.execute({
          sql: "SELECT * FROM v2_document_requirements WHERE program_id = ? ORDER BY created_at ASC",
          args: [pid],
        }),
        db.execute({
          sql: "SELECT * FROM v2_submissions WHERE participant_id = ? AND program_id = ? ORDER BY created_at DESC",
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
          sql: "SELECT * FROM v2_standups WHERE participant_id = ? AND program_id = ? ORDER BY created_at DESC",
          args: [cid, pid],
        }),
        db.execute({
          sql: "SELECT * FROM v2_checkins WHERE participant_id = ? AND program_id = ? ORDER BY created_at DESC",
          args: [cid, pid],
        }),
        db.execute({
          sql: "SELECT * FROM v2_retros WHERE participant_id = ? AND program_id = ? ORDER BY created_at DESC",
          args: [cid, pid],
        }),
        db.execute({
          sql: "SELECT * FROM v2_reflections WHERE participant_id = ? AND program_id = ? ORDER BY created_at DESC",
          args: [cid, pid],
        }),
      ]);

      const program = progRes.rows[0];
      if (!program) continue;

      const sessions = sesRes.rows || [];
      const deliverables = delRes.rows || [];
      const submissions = subRes.rows || [];
      const attendance = attRes.rows || [];
      const kpis = kpiRes.rows || [];
      const standups = standupRes.rows || [];
      const checkins = checkinRes.rows || [];
      const retros = retroRes.rows || [];
      const reflections = reflectRes.rows || [];

      totalStandups += standups.length;
      totalCheckins += checkins.length;
      totalRetros += retros.length;
      totalReflections += reflections.length;

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
      const programCompletion = Math.round(
        (completedDeliverables / totalDeliverables) * 100,
      );

      const totalSessions = sessions.length || 1;
      const attendedSessions = attendance.filter(
        (a) => a.status === "present",
      ).length;
      const attendanceRate = Math.round(
        (attendedSessions / totalSessions) * 100,
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

      const weeksWithRituals = new Set();
      standups.forEach((s) => weeksWithRituals.add(s.week_number));
      checkins.forEach((c) => weeksWithRituals.add(c.week_number));
      retros.forEach((r) => weeksWithRituals.add(r.week_number));
      reflections.forEach((r) => weeksWithRituals.add(r.week_number));
      const totalWeeks = program.duration_weeks || currentWeek || 1;
      const ritualParticipation = Math.round(
        (weeksWithRituals.size / totalWeeks) * 100,
      );

      overallSubmissions += totalSubmissions;
      overallApproved += approvedSubmissions;
      overallSessions += totalSessions;
      overallAttended += attendedSessions;
      overallKpis += totalKpis;
      overallKpisMet += targetMetKpis;
      overallDeliverables += totalDeliverables;
      overallCompletedDels += completedDeliverables;

      const milestones = [];
      sessions.forEach((s) => {
        const att = attendance.find(
          (a) => String(a.session_id) === String(s.id),
        );
        milestones.push({
          id: `session-${s.id}`,
          title: `Attended: ${s.title}`,
          type: "attendance",
          week: s.week_number,
          achieved: att?.status === "present",
          date: att?.date || s.start_at,
        });
      });
      deliverables.forEach((d) => {
        const sub = submissions.find((s) => s.document_id === d.id);
        milestones.push({
          id: `deliverable-${d.id}`,
          title: `Completed: ${d.title}`,
          type: "deliverable",
          week: d.week_number || 0,
          achieved: sub?.status === "approved",
          date: sub?.created_at || d.created_at,
          score: sub?.score || 0,
        });
      });

      const historyByWeek = [];
      for (let w = 1; w <= currentWeek; w++) {
        const weekDels = deliverables.filter((d) => (d.week_number || 1) === w);
        const weekDelsCompleted = weekDels.filter((d) =>
          submissions.some(
            (s) => s.document_id === d.id && s.status === "approved",
          ),
        ).length;
        const weekSessions = sessions.filter((s) => (s.week_number || 1) === w);
        const weekAttended = weekSessions.filter((s) =>
          attendance.some(
            (a) =>
              String(a.session_id) === String(s.id) && a.status === "present",
          ),
        ).length;
        historyByWeek.push({
          week: w,
          deliverablesCompleted: weekDelsCompleted,
          deliverablesTotal: weekDels.length,
          sessionsAttended: weekAttended,
          sessionsTotal: weekSessions.length,
          hasRitual: weeksWithRituals.has(w),
        });
      }

      programsData.push({
        id: program.id,
        name: program.name,
        cohort: contact.group_name || "Cohort 1",
        currentWeek,
        durationWeeks: program.duration_weeks,
        metrics: {
          programCompletion,
          attendanceRate,
          assignmentCompletion,
          kpiCompletion,
          ritualParticipation,
        },
        stats: {
          totalDeliverables,
          completedDeliverables,
          totalSessions,
          attendedSessions,
          totalSubmissions,
          approvedSubmissions,
          totalKpis,
          targetMetKpis,
          standups: standups.length,
          checkins: checkins.length,
          retros: retros.length,
          reflections: reflections.length,
        },
        milestones: milestones.sort((a, b) => {
          if (a.achieved !== b.achieved) return a.achieved ? -1 : 1;
          return (b.week || 0) - (a.week || 0);
        }),
        history: historyByWeek,
      });
    }

    const overallProgramCompletion =
      overallDeliverables > 0
        ? Math.round((overallCompletedDels / overallDeliverables) * 100)
        : 0;
    const overallAttendanceRate =
      overallSessions > 0
        ? Math.round((overallAttended / overallSessions) * 100)
        : 0;
    const overallAssignmentCompletion =
      overallSubmissions > 0
        ? Math.round((overallApproved / overallSubmissions) * 100)
        : 0;
    const overallKpiCompletion =
      overallKpis > 0 ? Math.round((overallKpisMet / overallKpis) * 100) : 0;
    const totalRituals =
      totalStandups + totalCheckins + totalRetros + totalReflections;

    return NextResponse.json({
      success: true,
      participant: {
        name: contact.name,
        email: contact.email,
        groupName: contact.group_name,
      },
      overall: {
        programCompletion: overallProgramCompletion,
        attendanceRate: overallAttendanceRate,
        assignmentCompletion: overallAssignmentCompletion,
        kpiCompletion: overallKpiCompletion,
        ritualParticipation:
          programsData.length > 0
            ? Math.round(
                programsData.reduce(
                  (acc, p) => acc + p.metrics.ritualParticipation,
                  0,
                ) / programsData.length,
              )
            : 0,
      },
      programs: programsData,
      totals: {
        submissions: overallSubmissions,
        approved: overallApproved,
        sessions: overallSessions,
        attended: overallAttended,
        deliverables: overallDeliverables,
        completedDeliverables: overallCompletedDels,
        rituals: totalRituals,
        programs: programsData.length,
      },
    });
  } catch (error) {
    console.error("Progress API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
