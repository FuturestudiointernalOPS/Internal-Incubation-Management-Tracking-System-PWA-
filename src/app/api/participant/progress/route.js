import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getParticipantProgramIds } from "@/lib/participant-membership";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session)
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );

    const cid = session.cid;
    const email = session.email;

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

    const programIds = new Set(
      await getParticipantProgramIds({ cid, email, contact }),
    );

    const programsData = [];
    let overallSubmissions = 0,
      overallApproved = 0,
      overallSessions = 0,
      overallAttended = 0;
    let overallKpiPoints = 0,
      overallKpiMax = 0,
      overallDeliverables = 0,
      overallCompletedDels = 0;
    let totalStandups = 0,
      totalCheckins = 0,
      totalRetros = 0,
      totalReflections = 0;

    for (const pid of Array.from(programIds)) {
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
          sql: "SELECT * FROM v2_programs WHERE id::text = ?",
          args: [pid],
        }),
        db.execute({
          sql: "SELECT * FROM v2_sessions WHERE program_id::text = ? ORDER BY week_number ASC",
          args: [pid],
        }),
        db.execute({
          sql: "SELECT * FROM v2_document_requirements WHERE program_id::text = ? ORDER BY created_at ASC",
          args: [pid],
        }),
        db.execute({
          sql: "SELECT * FROM v2_submissions WHERE participant_id::text = ? AND program_id::text = ? ORDER BY created_at DESC",
          args: [cid, pid],
        }),
        db.execute({
          sql: "SELECT a.* FROM v2_attendance a WHERE a.program_id::text = ? AND a.participant_id::text = ?",
          args: [pid, cid],
        }),
        db.execute({
          sql: "SELECT * FROM v2_kpis WHERE program_id::text = ?",
          args: [pid],
        }),
        db.execute({
          				sql: "SELECT * FROM v2_standups WHERE user_id = ? ORDER BY created_at DESC",
          				args: [cid],
        }),
        db.execute({
          sql: "SELECT * FROM v2_checkins WHERE participant_id = ? AND program_id = ? ORDER BY created_at DESC",
          args: [cid, pid],
        }),
        db.execute({
          				sql: "SELECT * FROM v2_retros WHERE user_id = ? ORDER BY created_at DESC",
          				args: [cid],
        }),
        db.execute({
          				sql: "SELECT * FROM v2_reflections WHERE user_id = ? ORDER BY created_at DESC",
          				args: [cid],
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

      // System-generated attendance deliverables are recorded by staff, not
      // submitted by participants — exclude them from completion.
      const nonAttendanceDeliverables = unlockedDeliverables.filter(
        (d) => !d.title?.toLowerCase().includes("attendance"),
      );
      const totalDeliverables = nonAttendanceDeliverables.length || 1;
      const completedDeliverables = nonAttendanceDeliverables.filter((d) =>
        submissions.some(
          (s) =>
            s.status === "approved" &&
            (String(s.document_id) === String(d.id) ||
              String(s.deliverable_id) === String(d.id)),
        ),
      ).length;
      const programCompletion = Math.round(
        (completedDeliverables / totalDeliverables) * 100,
      );

      const attendedSessions = attendance.filter(
        (a) => a.status === "present",
      ).length;
      // Expected attendance = sessions unlocked so far (future sessions don't count).
      const totalSessions = unlockedSessions.length || 1;
      // A program "tracks" attendance only when attendance records actually exist.
      const attMetaRes = await db.execute({
        sql: "SELECT COUNT(*) AS total FROM v2_attendance WHERE program_id::text = ?",
        args: [pid],
      });
      const attendanceTracked = parseInt(attMetaRes.rows[0]?.total || 0) > 0;
      const attendanceRate = Math.round(
        (attendedSessions / totalSessions) * 100,
      );
      // KPI attendance factor only considers the days where presence was actually
      // marked for this participant (unmarked sessions don't penalize it).
      const markedAttendanceDays = new Set(
        attendance.map((a) => a.date).filter(Boolean),
      ).size;
      const presentAttendanceDays = new Set(
        attendance
          .filter((a) => a.status === "present")
          .map((a) => a.date)
          .filter(Boolean),
      ).size;
      const markedAttendanceRate =
        markedAttendanceDays > 0
          ? Math.round((presentAttendanceDays / markedAttendanceDays) * 100)
          : 0;

      const approvedSubmissions = submissions.filter(
        (s) => s.status === "approved",
      ).length;
      const totalSubmissions = submissions.length || 1;
      const assignmentCompletion = Math.round(
        (approvedSubmissions / totalSubmissions) * 100,
      );

      // ─── KPI Achievement — per participant ───
      // Each KPI counts as "achieved" only if the participant has an APPROVED
      // submission on a deliverable linked to that KPI.
      const approvedSubs = submissions.filter((s) => s.status === "approved");
      const deliverableIdsByKpi = new Map();
      for (const d of deliverables) {
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
      const perKpiAchieved = kpis.map((kpi) => {
        const linked = deliverableIdsByKpi.get(String(kpi.id)) || new Set();
        return approvedSubs.some(
          (s) =>
            linked.has(String(s.deliverable_id)) ||
            linked.has(String(s.document_id)),
        );
      });
      const totalKpis = kpis.length;
      const targetMetKpis = perKpiAchieved.filter(Boolean).length;
      // Attendance counts as an extra factor in KPI achievement when the
      // program actually tracks attendance (at least one record exists).
      const kpiFactors = perKpiAchieved.map((ok) => (ok ? 100 : 0));
      if (attendanceTracked) kpiFactors.push(markedAttendanceRate);
      const kpiCompletion =
        kpiFactors.length > 0
          ? Math.round(
              kpiFactors.reduce((sum, v) => sum + v, 0) / kpiFactors.length,
            )
          : 0;

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
      overallKpiPoints +=
        targetMetKpis * 100 + (attendanceTracked ? markedAttendanceRate : 0);
      overallKpiMax += totalKpis * 100 + (attendanceTracked ? 100 : 0);
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
        // Attendance tasks are recorded by staff, not submitted by participants.
        if (d.title?.toLowerCase().includes("attendance")) return;
        const sub = submissions.find(
          (s) =>
            String(s.document_id) === String(d.id) ||
            String(s.deliverable_id) === String(d.id),
        );
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
        const weekDels = deliverables.filter(
          (d) =>
            (d.week_number || 1) === w &&
            !d.title?.toLowerCase().includes("attendance"),
        );
        const weekDelsCompleted = weekDels.filter((d) =>
          submissions.some(
            (s) =>
              s.status === "approved" &&
              (String(s.document_id) === String(d.id) ||
                String(s.deliverable_id) === String(d.id)),
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
      overallKpiMax > 0
        ? Math.round((overallKpiPoints / overallKpiMax) * 100)
        : 0;
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
