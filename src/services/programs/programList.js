/**
 * Programs — the program list read and its per-program score (SERVICE layer).
 *
 * The domain work behind `GET /api/pm/programs`: how the aggregate metric rows
 * fold into a program card, the completion index and its four weights, and the
 * facilitator shaping. The CONTROLLER keeps authentication and the response
 * envelope; everything below is how the list is BUILT.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and shaping, no SQL, no HTTP. It
 * reads through `@/models/**` and returns a plain `{ status, body }`.
 */

import {
  autoActivatePlannedPrograms,
  countActiveParticipantsByProgram,
  countDocumentRequirementsByProgram,
  countReportWeeksByProgram,
  countSessionsByProgram,
  countSubmissionsByProgram,
  getAssignedFamiliesByProgram,
  getProgramFacilitators,
  listProgramsByManagementFilters,
} from "@/models/programs";
import { parseJsonObject } from "./programShared";

/** Shape a facilitator row: parse its permission JSON, fall back to the id. */
function shapeFacilitator(facilitator) {
  let permissions = facilitator.permissions || {};
  if (typeof permissions === "string") {
    try {
      permissions = JSON.parse(permissions);
    } catch {
      permissions = {};
    }
  }
  return {
    id: facilitator.id,
    cid: facilitator.staff_id,
    role: facilitator.role || "facilitator",
    permissions,
    name: facilitator.name || facilitator.email || facilitator.staff_id,
    email: facilitator.email || facilitator.staff_id,
  };
}

/**
 * The program list a caller may see, with its aggregate metrics folded onto each
 * row. Returns `{ status, body }` where `body.programs` is the enriched list.
 *
 * The completion index is computed in JavaScript (not the database) from four
 * weighted blocks; a program can never be reported above 100%.
 */
export async function listProgramRecords({
  showAll,
  showArchived,
  status,
  assignedPmId,
  session,
}) {
  // Auto-activate programs where start_date has passed (gracefully fail if
  // columns missing).
  try {
    await autoActivatePlannedPrograms();
  } catch (_) {}

  const programsRes = await listProgramsByManagementFilters({
    showAll,
    showArchived,
    status,
    assignedPmId,
    session,
  });
  const programs = programsRes.rows;

  if (programs.length === 0) {
    return { status: 200, body: { success: true, programs: [] } };
  }

  // Fetch aggregate metrics (grouped).
  const [sessions, participants, docs, reports, segments, submissions] =
    await Promise.all([
      countSessionsByProgram(),
      countActiveParticipantsByProgram(),
      countDocumentRequirementsByProgram(),
      countReportWeeksByProgram(),
      getAssignedFamiliesByProgram(),
      countSubmissionsByProgram(),
    ]);

  // Map metrics for O(1) lookup.
  const metrics = {
    sessions: Object.fromEntries(sessions.rows.map((row) => [row.program_id, row])),
    participants: Object.fromEntries(
      participants.rows.map((row) => [row.program_id, row.count]),
    ),
    docs: Object.fromEntries(docs.rows.map((row) => [row.program_id, row])),
    reports: Object.fromEntries(
      reports.rows.map((row) => [row.program_id, row.weeks]),
    ),
    segments: segments.rows.reduce((accumulator, row) => {
      if (!accumulator[row.program_id]) accumulator[row.program_id] = [];
      accumulator[row.program_id].push(row.id);
      return accumulator;
    }, {}),
    submissions: Object.fromEntries(
      submissions.rows.map((row) => [row.program_id, row]),
    ),
  };

  const enrichedPrograms = await Promise.all(
    programs.map(async (program) => {
      const sessionMetrics = metrics.sessions[program.id] || { count: 0, completed: 0 };
      const docMetrics = metrics.docs[program.id] || { count: 0, completed: 0 };
      const reportWeeks = metrics.reports[program.id] || 0;
      const submissionMetrics = metrics.submissions[program.id] || { total: 0, approved: 0 };

      // Calculate Completion Index in JS to offload DB.
      const sessionsWeight = sessionMetrics.completed * 5.0;
      const docsWeight = docMetrics.completed * 2.0;
      const reportsWeight = reportWeeks * 10.0;
      const submissionsWeight = submissionMetrics.approved * 3.0;

      const duration = Number(program.duration_weeks) || 4;
      // Expected submissions use the number of ACTIVE participants (the same
      // deduped, non-facilitator count shown on the card), not the stale counter
      // that may sit on the program row.
      const participantCount = metrics.participants[program.id] || 0;
      const totalPossibleWeight =
        sessionMetrics.count * 5.0 +
        docMetrics.count * 2.0 +
        duration * 10.0 +
        docMetrics.count * participantCount * 3.0;
      const rawCompletion =
        totalPossibleWeight > 0
          ? ((sessionsWeight + docsWeight + reportsWeight + submissionsWeight) /
              totalPossibleWeight) *
            100
          : 0;
      // A program cannot be more than 100% done (e.g. more report weeks than the
      // planned duration would otherwise overshoot).
      const completion_index = Math.max(0, Math.min(100, rawCompletion));

      // Program facilitators (external personnel, role='facilitator').
      let facilitators = [];
      try {
        const facilitatorsResult = await getProgramFacilitators(program.id);
        facilitators = facilitatorsResult.rows.map(shapeFacilitator);
      } catch (_) {}

      // Parse facilitator default permissions defensively.
      const facilitatorDefaultPermissions = parseJsonObject(
        program.facilitator_default_permissions,
      );

      return {
        ...program,
        sessions_count: sessionMetrics.count,
        participants_count: metrics.participants[program.id] || 0,
        docs_total: docMetrics.count,
        docs_completed: docMetrics.completed,
        reports_count: reportWeeks,
        completion_index: Math.round(completion_index),
        assigned_segments: metrics.segments[program.id] || [],
        submissions_total: submissionMetrics.total,
        submissions_approved: submissionMetrics.approved,
        facilitators,
        facilitator_default_permissions: facilitatorDefaultPermissions,
        facilitator_scope: program.facilitator_scope || "assigned_groups",
      };
    }),
  );

  return { status: 200, body: { success: true, programs: enrichedPrograms } };
}
