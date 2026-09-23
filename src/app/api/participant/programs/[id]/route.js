import { initDb } from "@/lib/db";
import {
  getKnowledgeBankAttachmentsByNoteIds,
  getParticipantKnowledgeBankItems,
  getParticipantProgramDetailAttendance,
  getParticipantProgramDetailById,
  getParticipantProgramDetailDeliverables,
  getParticipantProgramDetailKpis,
  getParticipantProgramDetailPmName,
  getParticipantProgramDetailSessions,
  getParticipantProgramDetailStaff,
  getParticipantProgramDetailSubmissions,
  getParticipantProgramEnrollmentByCid,
  getParticipantProgramFollowups,
  getProgramDetailAttendanceCount,
} from "@/models/programMembership";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { isParticipantInProgram } from "@/lib/participant-membership";
import { getProgramLearningForParticipant } from "@/lib/lms/programRequirements";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
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
    const { id: programId } = await params;

    // Verify the participant is actually assigned to this program.
    const enrollmentResult = await getParticipantProgramEnrollmentByCid(cid);
    const contact = enrollmentResult.rows[0];

    const isAssigned = await isParticipantInProgram({
      cid,
      email: session.email,
      programId,
      contact,
    });

    if (!isAssigned) {
      return NextResponse.json(
        { success: false, error: "You are not enrolled in this program." },
        { status: 403 },
      );
    }

    const programResult = await getParticipantProgramDetailById(programId);
    if (programResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Program not found" },
        { status: 404 },
      );
    }
    const program = programResult.rows[0];

    const [sessionsResult, deliverablesResult, submissionsResult, attendanceResult, kpisResult, staffResult, followupsResult, knowledgeResult] =
      await Promise.all([
        getParticipantProgramDetailSessions(programId),
        getParticipantProgramDetailDeliverables(programId),
        getParticipantProgramDetailSubmissions(cid, programId),
        getParticipantProgramDetailAttendance(cid, programId),
        getParticipantProgramDetailKpis(programId),
        getParticipantProgramDetailStaff(programId),
        getParticipantProgramFollowups(programId),
        getParticipantKnowledgeBankItems(),
      ]);

    const sessions = sessionsResult.rows || [];
    const deliverables = deliverablesResult.rows || [];
    const submissions = submissionsResult.rows || [];
    const attendance = attendanceResult.rows || [];
    const kpis = kpisResult.rows || [];
    const facilitators = (staffResult.rows || []).map((staff) => ({
      id: staff.staff_id,
      name: staff.staff_name || staff.staff_id,
      role: staff.role,
    }));
    const followups = followupsResult.rows || [];
    const knowledgeItems = knowledgeResult.rows || [];

    // Fetch actual file URLs from knowledge_attachments
    let attachmentsByNote = {};
    if (knowledgeItems.length > 0) {
      try {
        const attachmentsResult = await getKnowledgeBankAttachmentsByNoteIds(
          knowledgeItems.map((knowledgeItem) => knowledgeItem.id),
        );
        for (const attachment of attachmentsResult.rows || []) {
          if (!attachmentsByNote[attachment.note_id]) attachmentsByNote[attachment.note_id] = [];
          attachmentsByNote[attachment.note_id].push({ name: attachment.name, url: attachment.url });
        }
      } catch (_) {}
    }

    let pmName = null;
    if (program.assigned_pm_id) {
      const pmResult = await getParticipantProgramDetailPmName(program.assigned_pm_id);
      if (pmResult.rows.length > 0) pmName = pmResult.rows[0].name;
    }

    // ─── Determine locked/unlocked status for all weeks ───
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

    const currentWeek =
      unlockedSessions.length > 0
        ? Math.max(...unlockedSessions.map((session) => session.week_number || 1))
        : 1;

    // Only show KPIs linked to all sessions
    const unlockedKpiIds = new Set();
    for (const session of sessions) {
      try {
        const ids =
          typeof session.kpi_ids === "string"
            ? JSON.parse(session.kpi_ids || "[]")
            : session.kpi_ids || [];
        for (const id of ids) unlockedKpiIds.add(Number(id));
      } catch (_) {}
    }
    const visibleKpis =
      unlockedKpiIds.size > 0
        ? kpis.filter((kpi) => unlockedKpiIds.has(Number(kpi.id)))
        : sessions.length > 0
          ? kpis
          : [];

    // Build weekly curriculum from all content
    const weeks = [];
    const weekMap = new Map();
    for (const session of sessions) {
      const weekNumber = session.week_number || 1;
      if (!weekMap.has(weekNumber))
        weekMap.set(weekNumber, {
          number: weekNumber,
          sessions: [],
          deliverables: [],
        });
      weekMap.get(weekNumber).sessions.push(session);
    }
    for (const deliverable of deliverables) {
      const weekNumber =
        deliverable.session_id != null
          ? sessions.find((session) => String(session.id) === String(deliverable.session_id))
              ?.week_number ?? deliverable.week_number ?? 1
          : deliverable.week_number ?? 1;
      if (!weekMap.has(weekNumber))
        weekMap.set(weekNumber, {
          number: weekNumber,
          sessions: [],
          deliverables: [],
        });
      weekMap.get(weekNumber).deliverables.push(deliverable);
    }

    for (const [weekNumber, weekData] of weekMap) {
      const completedDeliverableCount = weekData.deliverables.filter((deliverable) =>
        submissions.some(
          (submission) =>
            String(submission.deliverable_id || submission.document_id) === String(deliverable.id) &&
            submission.status === "approved",
        ),
      ).length;
      
      const isWeekUnlocked = weekData.sessions.some(checkUnlocked) || unlockedSessionWeekNumbers.has(weekNumber) || (weekNumber <= currentWeek);

      weeks.push({
        number: weekData.number,
        sessions: weekData.sessions,
        locked: !isWeekUnlocked,
        deliverables: weekData.deliverables.map((deliverable) => {
          const matchedSubmission = submissions.find(
            (submission) => String(submission.deliverable_id || submission.document_id) === String(deliverable.id),
          );
          return {
            id: deliverable.id,
            title: deliverable.title,
            description: deliverable.description,
            dueDate: deliverable.due_date || deliverable.created_at,
            allowedFormat: deliverable.allowed_format,
            weight: deliverable.weight,
            submission: matchedSubmission
              ? {
                  id: matchedSubmission.id,
                  status: matchedSubmission.status,
                  fileUrl: matchedSubmission.file_url,
                  score: matchedSubmission.score,
                  submittedAt: matchedSubmission.created_at,
                }
              : null,
          };
        }),
        completed:
          weekData.deliverables.length > 0 &&
          completedDeliverableCount === weekData.deliverables.length,
        isCurrent: weekData.number === currentWeek,
      });
    }
    weeks.sort((first, second) => first.number - second.number);

    // ─── Phase 6: LMS learning items per week (progress read from the LMS —
    // the Program never stores a second progress counter).
    const learningItems = await getProgramLearningForParticipant(programId, cid);
    const learningByWeek = new Map();
    for (const item of learningItems) {
      const weekNumber = item.week_number != null ? Number(item.week_number) : null;
      if (weekNumber == null) continue;
      if (!learningByWeek.has(weekNumber)) learningByWeek.set(weekNumber, []);
      learningByWeek.get(weekNumber).push(item);
    }
    for (const week of weeks) {
      week.learning = learningByWeek.get(Number(week.number)) || [];
    }

    // Build resources with real attachment URLs
    const resources = knowledgeItems.map((knowledgeItem) => {
      const attachments = attachmentsByNote[knowledgeItem.id] || [];
      return {
        id: knowledgeItem.id,
        title: knowledgeItem.title,
        description: knowledgeItem.description,
        url: attachments.length > 0 ? attachments[0].url : null,
        fileType: knowledgeItem.file_type,
        filePath: knowledgeItem.file_path,
        category: knowledgeItem.category,
        tags: knowledgeItem.tags ? knowledgeItem.tags.split(",").map((tag) => tag.trim()) : [],
        attachments,
        createdAt: knowledgeItem.created_at,
      };
    });
    const resourcesByWeek = new Map();
    for (const resource of resources) {
      const matchedSession = unlockedSessions.find(
        (session) =>
          resource.tags?.includes(String(session.id)) ||
          resource.category === String(session.id) ||
          resource.title?.toLowerCase().includes(`week ${session.week_number}`),
      );
      const weekNum = matchedSession?.week_number || 0;
      if (!resourcesByWeek.has(weekNum)) resourcesByWeek.set(weekNum, []);
      resourcesByWeek.get(weekNum).push(resource);
    }
    const generalResources = resources.filter((resource) => {
      for (const [, weekResources] of resourcesByWeek) {
        if (weekResources.includes(resource)) return false;
      }
      return true;
    });

    const unlockedWeeks = weeks.filter((week) => !week.locked);
    const unlockedDeliverables = unlockedWeeks.flatMap((week) => week.deliverables);

    // ─── 1. Program completion — performance-based, computed below from the
    // approved deliverables (falls back to approved submissions when the
    // program tracks no deliverables). Kept in sync with the dashboard card.

    // ─── 2. Deliverables done — exclude 'attendance' deliverables ───
    const unlockedNonAttendanceDeliverables = unlockedDeliverables.filter(
      (deliverable) => !deliverable.title?.toLowerCase().includes("attendance")
    );
    const totalDeliverables = unlockedNonAttendanceDeliverables.length;
    const completedDeliverables = unlockedNonAttendanceDeliverables.filter((deliverable) =>
      submissions.some(
        (submission) =>
          String(submission.deliverable_id || submission.document_id) === String(deliverable.id) &&
          submission.status === "approved",
      ),
    ).length;
    const percentComplete =
      totalDeliverables > 0
        ? Math.round((completedDeliverables / totalDeliverables) * 100)
        : submissions.length > 0
          ? Math.round(
              (submissions.filter((submission) => submission.status === "approved").length /
                submissions.length) *
                100,
            )
          : 0;

    // ─── 3. Attendance — for this participant only ───
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
    // Total sessions this participant was expected to attend = sessions that are unlocked
    const totalSessions = unlockedSessions.length || 1;
    // A program "tracks" attendance only when attendance records actually exist.
    const attendanceMetaResult = await getProgramDetailAttendanceCount(programId);
    const attendanceTracked = parseInt(attendanceMetaResult.rows[0]?.total || 0) > 0;
    const attendanceRate = Math.round((attendedSessions / totalSessions) * 100);

    // ─── 4. KPI Progress — per participant ───
    // A participant's KPI achievement is the average across the program's KPIs,
    // where each KPI counts as "achieved" only if they have an APPROVED
    // submission on a deliverable linked to that KPI.
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

    return NextResponse.json({
      success: true,
      program: {
        id: program.id,
        name: program.name,
        description: program.description,
        status: program.status,
        startDate: program.start_date,
        endDate: program.end_date,
        durationWeeks: program.duration_weeks,
        currentWeek,
        programMode: program.program_mode,
        pmName,
        facilitators,
        metrics: {
          percentComplete,
          attendanceRate,
          kpiCompletion,
          currentWeek,
          totalDeliverables,
          completedDeliverables,
          totalSessions,
          attendedSessions,
        },
      },
      curriculum: { weeks, totalWeeks: weeks.length, currentWeek },
      submissions,
      attendance,
      kpis: visibleKpis,
      followups,
      resources: {
        byWeek: Object.fromEntries(resourcesByWeek),
        general: generalResources,
        total: resources.length,
      },
    });
  } catch (error) {
    console.error("Participant Program Detail Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
