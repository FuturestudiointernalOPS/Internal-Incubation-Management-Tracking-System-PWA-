import { initDb } from "@/lib/db";
import {
  getParticipantAttendanceCount,
  getParticipantContactProfile,
  getParticipantProgramAttendance,
  getParticipantProgramById,
  getParticipantProgramDeliverables,
  getParticipantProgramKpis,
  getParticipantProgramPmName,
  getParticipantProgramSessions,
  getParticipantProgramStaff,
  getParticipantProgramSubmissions,
} from "@/models/programMembership";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { getParticipantProgramIds } from "@/lib/participant-membership";

export const dynamic = "force-dynamic";

export async function GET(_req) {
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

    const contactResult = await getParticipantContactProfile(cid);
    if (contactResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Participant not found" },
        { status: 404, headers },
      );
    }
    const contact = contactResult.rows[0];

    const programIds = new Set(
      await getParticipantProgramIds({ cid, email, contact }),
    );

    const programs = [];
    for (const programId of Array.from(programIds)) {
      const [programResult, sessionsResult, deliverablesResult, submissionsResult, attendanceResult, kpisResult, staffResult] =
        await Promise.all([
          getParticipantProgramById(programId),
          getParticipantProgramSessions(programId),
          getParticipantProgramDeliverables(programId),
          getParticipantProgramSubmissions(cid, programId),
          getParticipantProgramAttendance(cid, programId),
          getParticipantProgramKpis(programId),
          getParticipantProgramStaff(programId),
        ]);

      const program = programResult.rows[0];
      if (!program) continue;

      const sessions = sessionsResult.rows || [];
      const submissions = submissionsResult.rows || [];
      const deliverables = deliverablesResult.rows || [];
      const attendance = attendanceResult.rows || [];
      const kpis = kpisResult.rows || [];

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

      const totalDeliverables = unlockedDeliverables.length || 1;
      const completedDeliverables = unlockedDeliverables.filter((deliverable) =>
        submissions.some(
          (submission) =>
            String(submission.deliverable_id || submission.document_id) === String(deliverable.id) &&
            submission.status === "approved",
        ),
      ).length;
      let percentComplete = Math.round(
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
      const totalExpectedDays = unlockedSessions.length || 1;
      // A program "tracks" attendance only when attendance records actually exist.
      const attendanceMetaResult = await getParticipantAttendanceCount(program.id);
      const attendanceTracked = parseInt(attendanceMetaResult.rows[0]?.total || 0) > 0;
      const attendanceRate = Math.round(
        (attendedSessions / totalExpectedDays) * 100,
      );

      const approvedSubmissions = submissions.filter(
        (submission) => submission.status === "approved",
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
      const approvedSubmissionRows = (submissions || []).filter(
        (submission) => submission.status === "approved",
      );
      const deliverableIdsByKpi = new Map();
      for (const deliverable of deliverables || []) {
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
      // Attendance counts as an extra factor in KPI achievement when the
      // program actually tracks attendance (at least one record exists).
      const kpiFactors = (kpis || []).map((kpi) => {
        const linkedDeliverableIds = deliverableIdsByKpi.get(String(kpi.id)) || new Set();
        const isAchieved = approvedSubmissionRows.some((submission) =>
          linkedDeliverableIds.has(String(submission.deliverable_id)),
        );
        return isAchieved ? 100 : 0;
      });
      if (attendanceTracked) kpiFactors.push(attendanceRate);
      kpiCompletion =
        kpiFactors.length > 0
          ? Math.round(
              kpiFactors.reduce((sum, factor) => sum + factor, 0) / kpiFactors.length,
            )
          : 0;

      const facilitators = (staffResult.rows || []).map((staff) => ({
        id: staff.staff_id,
        name: staff.staff_name || staff.staff_id,
        role: staff.role,
      }));
      let pmName = null;
      if (program.assigned_pm_id) {
        const pmResult = await getParticipantProgramPmName(program.assigned_pm_id);
        if (pmResult.rows.length > 0) pmName = pmResult.rows[0].name;
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
