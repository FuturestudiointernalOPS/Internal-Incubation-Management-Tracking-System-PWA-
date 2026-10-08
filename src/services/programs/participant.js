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
import { isParticipantInProgram } from "@/models/participant-membership";
import { getProgramLearningForParticipant } from "@/models/lms/programRequirements";
import { buildCurriculumWeeks } from "./participantCurriculum";
import { computeParticipantMetrics } from "./participantMetrics";
import { shapeParticipantResources } from "./participantResources";

export async function getParticipantProgramDetailService({ cid, email, programId }) {
  // Verify the participant is actually assigned to this program.
  const enrollmentResult = await getParticipantProgramEnrollmentByCid(cid);
  const contact = enrollmentResult.rows[0];

  const isAssigned = await isParticipantInProgram({
    cid,
    email,
    programId,
    contact,
  });

  if (!isAssigned) {
    return {
      status: 403,
      body: { success: false, error: "You are not enrolled in this program." },
    };
  }

  const programResult = await getParticipantProgramDetailById(programId);
  if (programResult.rows.length === 0) {
    return {
      status: 404,
      body: { success: false, error: "Program not found" },
    };
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

  // ─── Weekly curriculum, with locked/unlocked status and the current week ───
  const { weeks, unlockedSessions, currentWeek } = buildCurriculumWeeks({
    sessions,
    deliverables,
    submissions,
  });

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
  const { resources, resourcesByWeek, generalResources } = shapeParticipantResources({
    knowledgeItems,
    attachmentsByNote,
    unlockedSessions,
  });

  // A program "tracks" attendance only when attendance records actually exist.
  const attendanceMetaResult = await getProgramDetailAttendanceCount(programId);
  const attendanceTracked = parseInt(attendanceMetaResult.rows[0]?.total || 0) > 0;

  // ─── Metrics: completion, attendance and KPI achievement ───
  const metrics = computeParticipantMetrics({
    weeks,
    unlockedSessions,
    attendance,
    submissions,
    deliverables,
    kpis,
    attendanceTracked,
  });

  return {
    status: 200,
    body: {
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
          ...metrics,
          currentWeek,
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
    }
  };
}
