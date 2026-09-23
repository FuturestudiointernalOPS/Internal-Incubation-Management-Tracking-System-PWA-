import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getParticipantProgramIds } from "@/lib/participant-membership";
import {
  getHomeContactByCid,
  getHomeProgramById,
  getHomeSessionsByProgramId,
  getHomeDeliverablesByProgramId,
  getHomeSubmissionsByParticipantProgram,
  getHomeAttendanceByProgram,
  getHomeKpisByProgramId,
  countHomeAttendanceByProgramId,
  getHomeNotifications,
  getHomeEventsByProgramIds,
} from "@/models/participantPortal";
import { getCalendarVentureSessions } from "@/models/workspace";

export const dynamic = "force-dynamic";

export async function GET(_req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const cid = session.cid;
    const email = session.email;

    const contactRes = await getHomeContactByCid(cid);

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

    const programIdList = Array.from(programIds);
    const programsData = [];

    for (const programId of programIdList) {
      const [programResult, sessionsResult, deliverablesResult, submissionsResult, attendanceResult, kpisResult] =
        await Promise.all([
          getHomeProgramById(programId),
          getHomeSessionsByProgramId(programId),
          getHomeDeliverablesByProgramId(programId),
          getHomeSubmissionsByParticipantProgram(cid, programId),
          getHomeAttendanceByProgram(cid, programId),
          getHomeKpisByProgramId(programId),
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
      // System-generated attendance deliverables are recorded by staff, not
      // submitted by participants — exclude them from completion.
      const nonAttendanceDeliverables = unlockedDeliverables.filter(
        (deliverable) => !deliverable.title?.toLowerCase().includes("attendance"),
      );
      const totalDeliverables = nonAttendanceDeliverables.length || 1;
      const completedDeliverables = nonAttendanceDeliverables.filter((deliverable) => {
        const matchingSubmission = submissions.find((submission) => String(submission.deliverable_id || submission.document_id) === String(deliverable.id));
        return matchingSubmission && matchingSubmission.status === "approved";
      }).length;
      let programCompletion = Math.round(
        (completedDeliverables / totalDeliverables) * 100,
      );

      // A program "tracks" attendance only when attendance records actually exist.
      const attendanceMetaResult = await countHomeAttendanceByProgramId(program.id);
      const attendanceTracked = parseInt(attendanceMetaResult.rows[0]?.total || 0) > 0;
      // Expected attendance = sessions unlocked so far (future sessions don't count).
      const totalExpectedDays = unlockedSessions.length || 1;

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
      const attendanceRate = Math.round(
        (attendedSessions / totalExpectedDays) * 100,
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

      const totalAssignments = submissions.length || 1;
      const approvedAssignments = submissions.filter(
        (submission) => submission.status === "approved",
      ).length;
      const assignmentCompletion = Math.round(
        (approvedAssignments / totalAssignments) * 100,
      );

      // No deliverables tracked for this program → fall back to submissions so
      // programCompletion stays consistent with assignmentCompletion.
      if (unlockedDeliverables.length === 0 && submissions.length > 0) {
        programCompletion = assignmentCompletion;
      }

      // ─── KPI Achievement — per participant ───
      // A participant's KPI achievement is the average across the program's KPIs,
      // where each KPI counts as "achieved" only if they have an APPROVED
      // submission on a deliverable linked to that KPI.
      let kpiCompletion = 0;
      const approvedSubmissions = submissions.filter((submission) => submission.status === "approved");
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
      // Attendance counts as an extra factor in KPI achievement when the
      // program actually tracks attendance (at least one record exists).
      const kpiFactors = kpis.map((kpi) => {
        const linkedDeliverableIds = deliverableIdsByKpi.get(String(kpi.id)) || new Set();
        const isAchieved = approvedSubmissions.some(
          (submission) =>
            linkedDeliverableIds.has(String(submission.deliverable_id)) ||
            linkedDeliverableIds.has(String(submission.document_id)),
        );
        return isAchieved ? 100 : 0;
      });
      if (attendanceTracked) kpiFactors.push(markedAttendanceRate);
      kpiCompletion =
        kpiFactors.length > 0
          ? Math.round(
              kpiFactors.reduce((sum, factor) => sum + factor, 0) / kpiFactors.length,
            )
          : 0;

      programsData.push({
        id: program.id,
        name: program.name,
        description: program.description,
        status: program.status,
        startDate: program.start_date,
        endDate: program.end_date,
        durationWeeks: program.duration_weeks,
        currentWeek,
        cohort: contact.group_name || "Cohort 1",
        metrics: {
          percentComplete: programCompletion,
          programCompletion,
          attendanceRate,
          assignmentCompletion,
          kpiCompletion,
        },
        sessions,
        deliverables,
        submissions,
        attendance,
      });
    }

    const primaryProgram = programsData[0] || null;
    const primarySubmissions = primaryProgram ? primaryProgram.submissions : [];
    const pendingSubmissions = primarySubmissions.filter(
      (submission) => submission.status === "pending",
    );

    let overdueItems = [];
    let dueSoonItems = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (primaryProgram) {
      for (const deliverable of primaryProgram.deliverables) {
        // System-generated attendance tasks are recorded by staff, not submitted
        // by participants — they must never appear as overdue or due soon.
        if (deliverable.title?.toLowerCase().includes("attendance")) continue;
        if (!deliverable.due_date && !deliverable.created_at) continue;
        const dueDate = new Date(deliverable.due_date || deliverable.created_at);
        dueDate.setHours(0, 0, 0, 0);
        const existingSubmission = primaryProgram.submissions.find(
          (submission) =>
            String(submission.document_id) === String(deliverable.id) ||
            String(submission.deliverable_id) === String(deliverable.id),
        );
        const isApproved = existingSubmission?.status === "approved";
        if (!isApproved && dueDate < today) {
          overdueItems.push({
            id: deliverable.id,
            title: deliverable.title,
            type: "deliverable",
            dueDate: deliverable.due_date || deliverable.created_at,
            daysOverdue: Math.floor((today - dueDate) / (1000 * 60 * 60 * 24)),
            programId: primaryProgram.id,
            programName: primaryProgram.name,
          });
        } else if (!isApproved && dueDate >= today) {
          const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
          if (diffDays <= 7)
            dueSoonItems.push({
              id: deliverable.id,
              title: deliverable.title,
              type: "deliverable",
              dueDate: deliverable.due_date || deliverable.created_at,
              daysLeft: diffDays,
              programId: primaryProgram.id,
              programName: primaryProgram.name,
            });
        }
      }
    }

    const upcomingSessions = primaryProgram
      ? primaryProgram.sessions
          .filter((session) => {
            if (!session.start_at && !session.scheduled_date) return false;
            return new Date(session.start_at || session.scheduled_date) >= today;
          })
          .slice(0, 5)
      : [];

    const notificationsResult = await getHomeNotifications(cid, email);
    const announcements = (notificationsResult.rows || []).map((notification) => ({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type || "announcement",
      isRead: notification.is_read,
      createdAt: notification.created_at,
    }));

    // ─── Build calendar events from ALL enrolled programs ───
    let calendarEvents = [];
    const seenEventKeys = new Set();

    for (const program of programsData) {
      for (const session of program.sessions || []) {
        const sessionDate = session.start_at || session.scheduled_date;
        if (!sessionDate) continue;
        const date = new Date(sessionDate);
        const dateStr = date.toISOString().split("T")[0];
        const eventKey = `session-${session.id}`;
        if (seenEventKeys.has(eventKey)) continue;
        seenEventKeys.add(eventKey);
        calendarEvents.push({
          id: eventKey,
          title: session.title,
          date: dateStr,
          time: session.start_time || null,
          type: "session",
          source: "v2_sessions",
          relatedId: session.id,
          programId: program.id,
          description: program.name,
        });
      }
      for (const deliverable of program.deliverables || []) {
        // Attendance tasks are recorded by staff, not submitted by participants.
        if (deliverable.title?.toLowerCase().includes("attendance")) continue;
        if (!deliverable.due_date && !deliverable.created_at) continue;
        // Check if participant already submitted
        const existingSubmission = (program.submissions || []).find(
          (submission) =>
            String(submission.document_id) === String(deliverable.id) ||
            String(submission.deliverable_id) === String(deliverable.id),
        );
        const dueDate = new Date(deliverable.due_date || deliverable.created_at);
        const dateStr = dueDate.toISOString().split("T")[0];
        const eventKey = `deliverable-${deliverable.id}`;
        if (seenEventKeys.has(eventKey)) continue;
        seenEventKeys.add(eventKey);
        calendarEvents.push({
          id: eventKey,
          title: existingSubmission ? `${deliverable.title} (submitted)` : `${deliverable.title} (due)`,
          date: dateStr,
          time: null,
          type: existingSubmission ? "submission" : "deadline",
          source: "v2_document_requirements",
          relatedId: deliverable.id,
          programId: program.id,
          description: existingSubmission
            ? `Status: ${existingSubmission.status}`
            : program.name,
        });
      }
    }

    // Fetch events from v2_events for all enrolled programs
    try {
      if (programIdList.length > 0) {
        const eventsResult = await getHomeEventsByProgramIds(programIdList);
        for (const event of eventsResult.rows || []) {
          const eventDate = new Date(event.start_time);
          const dateStr = eventDate.toISOString().split("T")[0];
          const timeStr = eventDate.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          const eventKey = `event-${event.id}`;
          if (seenEventKeys.has(eventKey)) continue;
          seenEventKeys.add(eventKey);
          calendarEvents.push({
            id: eventKey,
            title: event.title || "Meeting",
            date: dateStr,
            time: timeStr,
            type: "event",
            source: "v2_events",
            relatedId: event.id,
            programId: event.program_id,
            description: event.description || event.event_type || "Review",
          });
        }
      }
    } catch (_) {}

    // Venture sessions (Vinance 3): booked sessions of the Ventures this
    // person belongs to. The model returns venture-facing sessions only —
    // internal staff sessions are never exposed to a founder.
    try {
      const ventureSessionsResult = await getCalendarVentureSessions(cid);
      for (const session of ventureSessionsResult.rows || []) {
        const eventKey = `vsess-${session.id}`;
        if (seenEventKeys.has(eventKey)) continue;
        seenEventKeys.add(eventKey);
        const sessionStart = new Date(session.start_time);
        calendarEvents.push({
          id: eventKey,
          title: session.title,
          date: sessionStart.toISOString().split("T")[0],
          time: sessionStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          type: "venture_session",
          source: "session",
          relatedId: session.id,
          description: session.coach_name ? `Coach: ${session.coach_name}` : null,
        });
      }
    } catch (_) {}

    calendarEvents.sort((first, second) => first.date.localeCompare(second.date));

    return NextResponse.json({
      success: true,
      participant: {
        cid: contact.cid,
        name: contact.name,
        email: contact.email,
        groupName: contact.group_name,
      },
      primaryProgram: primaryProgram
        ? {
            id: primaryProgram.id,
            name: primaryProgram.name,
            description: primaryProgram.description,
            status: primaryProgram.status,
            startDate: primaryProgram.startDate,
            endDate: primaryProgram.endDate,
            durationWeeks: primaryProgram.durationWeeks,
            currentWeek: primaryProgram.currentWeek,
            cohort: primaryProgram.cohort,
            metrics: primaryProgram.metrics,
            sessionCount: primaryProgram.sessions.length,
            deliverableCount: primaryProgram.deliverables.length,
          }
        : null,
      programs: programsData.map((program) => ({
        id: program.id,
        name: program.name,
        status: program.status,
        startDate: program.startDate,
        endDate: program.endDate,
        currentWeek: program.currentWeek,
        durationWeeks: program.durationWeeks,
        cohort: program.cohort,
        metrics: program.metrics,
      })),
      actionCenter: {
        overdue: overdueItems,
        dueSoon: dueSoonItems,
        pendingSubmissions: pendingSubmissions.map((submission) => ({
          id: submission.id,
          deliverableId: submission.document_id,
          status: submission.status,
          submittedAt: submission.created_at,
          programId: submission.program_id,
        })),
        upcomingSessions: upcomingSessions.map((session) => ({
          id: session.id,
          title: session.title,
          type: session.type,
          date: session.start_at || session.scheduled_date,
          time: session.start_time,
          weekNumber: session.week_number,
          programId: session.program_id,
        })),
      },
      calendarEvents,
      announcements,
    });
  } catch (error) {
    console.error("Participant Home API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
