import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getParticipantProgramIds } from "@/lib/participant-membership";
import {
  getProgressContactByCid,
  getProgressProgramById,
  getProgressSessionsByProgramId,
  getProgressDeliverablesByProgramId,
  getProgressSubmissionsByProgram,
  getProgressAttendanceByProgram,
  getProgressKpisByProgramId,
  getProgressStandupsByUser,
  getProgressCheckinsByParticipantProgram,
  getProgressRetrosByUser,
  getProgressReflectionsByUser,
  countProgressAttendanceByProgramId,
} from "@/models/participantPortal";

export const dynamic = "force-dynamic";

export async function GET(_req) {
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

    const contactResult = await getProgressContactByCid(cid);
    if (contactResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Participant not found" },
        { status: 404 },
      );
    }
    const contact = contactResult.rows[0];

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
      overallCompletedDeliverables = 0;
    let totalStandups = 0,
      totalCheckins = 0,
      totalRetros = 0,
      totalReflections = 0;

    for (const programId of Array.from(programIds)) {
      const [
        programResult,
        sessionsResult,
        deliverablesResult,
        submissionsResult,
        attendanceResult,
        kpisResult,
        standupsResult,
        checkinsResult,
        retrosResult,
        reflectionsResult,
      ] = await Promise.all([
        getProgressProgramById(programId),
        getProgressSessionsByProgramId(programId),
        getProgressDeliverablesByProgramId(programId),
        getProgressSubmissionsByProgram(cid, programId),
        getProgressAttendanceByProgram(programId, cid),
        getProgressKpisByProgramId(programId),
        getProgressStandupsByUser(cid),
        getProgressCheckinsByParticipantProgram(cid, programId),
        getProgressRetrosByUser(cid),
        getProgressReflectionsByUser(cid),
      ]);

      const program = programResult.rows[0];
      if (!program) continue;

      const sessions = sessionsResult.rows || [];
      const deliverables = deliverablesResult.rows || [];
      const submissions = submissionsResult.rows || [];
      const attendance = attendanceResult.rows || [];
      const kpis = kpisResult.rows || [];
      const standups = standupsResult.rows || [];
      const checkins = checkinsResult.rows || [];
      const retros = retrosResult.rows || [];
      const reflections = reflectionsResult.rows || [];

      totalStandups += standups.length;
      totalCheckins += checkins.length;
      totalRetros += retros.length;
      totalReflections += reflections.length;

      // ─── Determine unlocked sessions: a session unlocks once its status is
      // active/in progress/completed (PM marks the current week), its
      // scheduled_date has passed, or it has no date yet. Aligned with the
      // program detail route so the dashboard week matches the detail view. ───
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const checkUnlocked = (session) => {
        const status = String(session.status || "").toLowerCase();
        if (["active", "in progress", "completed"].includes(status)) return true;
        if (!session.scheduled_date) return true;
        const scheduledDate = new Date(session.scheduled_date);
        scheduledDate.setHours(0, 0, 0, 0);
        return scheduledDate <= today;
      };

      const unlockedSessions = sessions.filter(checkUnlocked);

      const unlockedSessionWeekNumbers = new Set(
        unlockedSessions.map((session) => session.week_number || 1),
      );
      // Resolve a deliverable's week from its session (type-safe string
      // comparison), falling back to its own week_number, then to 1.
      const deliverableWeek = (deliverable) => {
        if (deliverable.session_id != null) {
          const matchingSession = sessions.find((session) => String(session.id) === String(deliverable.session_id));
          if (matchingSession?.week_number != null) return matchingSession.week_number;
        }
        return deliverable.week_number ?? 1;
      };
      const unlockedDeliverables = deliverables.filter((deliverable) =>
        unlockedSessionWeekNumbers.has(deliverableWeek(deliverable)),
      );

      const currentWeek =
        unlockedSessions.length > 0
          ? Math.max(...unlockedSessions.map((session) => session.week_number || 1))
          : 1;

      // System-generated attendance deliverables are recorded by staff, not
      // submitted by participants — exclude them from completion.
      const nonAttendanceDeliverables = unlockedDeliverables.filter(
        (deliverable) => !deliverable.title?.toLowerCase().includes("attendance"),
      );
      const totalDeliverables = nonAttendanceDeliverables.length || 1;
      const completedDeliverables = nonAttendanceDeliverables.filter((deliverable) =>
        submissions.some(
          (submission) =>
            submission.status === "approved" &&
            (String(submission.document_id) === String(deliverable.id) ||
              String(submission.deliverable_id) === String(deliverable.id)),
        ),
      ).length;
      const programCompletion = Math.round(
        (completedDeliverables / totalDeliverables) * 100,
      );

      // Count distinct sessions with a "present" mark, restricted to unlocked
      // sessions, so duplicate attendance rows (same session recorded on
      // multiple dates) can never push the rate above 100%.
      const unlockedSessionIds = new Set(
        unlockedSessions.map((session) => String(session.id)),
      );
      const attendedSessions = new Set(
        attendance
          .filter(
            (record) =>
              record.status === "present" &&
              unlockedSessionIds.has(String(record.session_id)),
          )
          .map((record) => String(record.session_id)),
      ).size;
      // Expected attendance = sessions unlocked so far (future sessions don't count).
      const totalSessions = unlockedSessions.length || 1;
      // A program "tracks" attendance only when attendance records actually exist.
      const attendanceMetaResult = await countProgressAttendanceByProgramId(programId);
      const attendanceTracked = parseInt(attendanceMetaResult.rows[0]?.total || 0) > 0;
      const attendanceRate = Math.round(
        (attendedSessions / totalSessions) * 100,
      );
      // KPI attendance factor only considers the days where presence was actually
      // marked for this participant (unmarked sessions don't penalize it).
      const markedAttendanceDays = new Set(
        attendance.map((record) => record.date).filter(Boolean),
      ).size;
      const presentAttendanceDays = new Set(
        attendance
          .filter((record) => record.status === "present")
          .map((record) => record.date)
          .filter(Boolean),
      ).size;
      const markedAttendanceRate =
        markedAttendanceDays > 0
          ? Math.round((presentAttendanceDays / markedAttendanceDays) * 100)
          : 0;

      const approvedSubmissions = submissions.filter(
        (submission) => submission.status === "approved",
      ).length;
      const totalSubmissions = submissions.length || 1;
      const assignmentCompletion = Math.round(
        (approvedSubmissions / totalSubmissions) * 100,
      );

      // ─── KPI Achievement — per participant ───
      // Each KPI counts as "achieved" only if the participant has an APPROVED
      // submission on a deliverable linked to that KPI.
      const approvedSubmissionRows = submissions.filter((submission) => submission.status === "approved");
      const deliverableIdsByKpi = new Map();
      for (const deliverable of deliverables) {
        let linkedKpiIds = [];
        try {
          linkedKpiIds =
            typeof deliverable.kpi_ids === "string"
              ? JSON.parse(deliverable.kpi_ids || "[]")
              : deliverable.kpi_ids || [];
        } catch (_) {
          linkedKpiIds = [];
        }
        for (const kpiId of linkedKpiIds) {
          const kpiKey = String(kpiId);
          if (!deliverableIdsByKpi.has(kpiKey)) {
            deliverableIdsByKpi.set(kpiKey, new Set());
          }
          deliverableIdsByKpi.get(kpiKey).add(String(deliverable.id));
        }
      }
      const perKpiAchieved = kpis.map((kpi) => {
        const linkedDeliverableIds = deliverableIdsByKpi.get(String(kpi.id)) || new Set();
        return approvedSubmissionRows.some(
          (submission) =>
            linkedDeliverableIds.has(String(submission.deliverable_id)) ||
            linkedDeliverableIds.has(String(submission.document_id)),
        );
      });
      const totalKpis = kpis.length;
      const targetMetKpis = perKpiAchieved.filter(Boolean).length;
      // Attendance counts as an extra factor in KPI achievement when the
      // program actually tracks attendance (at least one record exists).
      const kpiFactors = perKpiAchieved.map((isAchieved) => (isAchieved ? 100 : 0));
      if (attendanceTracked) kpiFactors.push(markedAttendanceRate);
      const kpiCompletion =
        kpiFactors.length > 0
          ? Math.round(
              kpiFactors.reduce((sum, factor) => sum + factor, 0) / kpiFactors.length,
            )
          : 0;

      const weeksWithRituals = new Set();
      standups.forEach((standup) => weeksWithRituals.add(standup.week_number));
      checkins.forEach((checkin) => weeksWithRituals.add(checkin.week_number));
      retros.forEach((retro) => weeksWithRituals.add(retro.week_number));
      reflections.forEach((reflection) => weeksWithRituals.add(reflection.week_number));
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
      overallCompletedDeliverables += completedDeliverables;

      const milestones = [];
      sessions.forEach((session) => {
        const attendanceRecord = attendance.find(
          (record) => String(record.session_id) === String(session.id),
        );
        milestones.push({
          id: `session-${session.id}`,
          title: `Attended: ${session.title}`,
          type: "attendance",
          week: session.week_number,
          achieved: attendanceRecord?.status === "present",
          date: attendanceRecord?.date || session.start_at,
        });
      });
      deliverables.forEach((deliverable) => {
        // Attendance tasks are recorded by staff, not submitted by participants.
        if (deliverable.title?.toLowerCase().includes("attendance")) return;
        const matchedSubmission = submissions.find(
          (submission) =>
            String(submission.document_id) === String(deliverable.id) ||
            String(submission.deliverable_id) === String(deliverable.id),
        );
        milestones.push({
          id: `deliverable-${deliverable.id}`,
          title: `Completed: ${deliverable.title}`,
          type: "deliverable",
          week: deliverable.week_number || 0,
          achieved: matchedSubmission?.status === "approved",
          date: matchedSubmission?.created_at || deliverable.created_at,
          score: matchedSubmission?.score || 0,
        });
      });

      const historyByWeek = [];
      for (let week = 1; week <= currentWeek; week++) {
        const weekDeliverables = deliverables.filter(
          (deliverable) =>
            (deliverable.week_number || 1) === week &&
            !deliverable.title?.toLowerCase().includes("attendance"),
        );
        const weekCompletedDeliverables = weekDeliverables.filter((deliverable) =>
          submissions.some(
            (submission) =>
              submission.status === "approved" &&
              (String(submission.document_id) === String(deliverable.id) ||
                String(submission.deliverable_id) === String(deliverable.id)),
          ),
        ).length;
        const weekSessions = sessions.filter((session) => (session.week_number || 1) === week);
        const weekAttended = weekSessions.filter((session) =>
          attendance.some(
            (record) =>
              String(record.session_id) === String(session.id) && record.status === "present",
          ),
        ).length;
        historyByWeek.push({
          week: week,
          deliverablesCompleted: weekCompletedDeliverables,
          deliverablesTotal: weekDeliverables.length,
          sessionsAttended: weekAttended,
          sessionsTotal: weekSessions.length,
          hasRitual: weeksWithRituals.has(week),
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
        milestones: milestones.sort((first, second) => {
          if (first.achieved !== second.achieved) return first.achieved ? -1 : 1;
          return (second.week || 0) - (first.week || 0);
        }),
        history: historyByWeek,
      });
    }

    const overallProgramCompletion =
      overallDeliverables > 0
        ? Math.round((overallCompletedDeliverables / overallDeliverables) * 100)
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
                  (accumulator, program) => accumulator + program.metrics.ritualParticipation,
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
        completedDeliverables: overallCompletedDeliverables,
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
