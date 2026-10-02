/**
 * Programs — the program lifecycle use cases (SERVICE layer).
 *
 * The domain work behind `/api/pm/programs`. The CONTROLLER still authenticates
 * and authorises (`requireAuth`, the `programs.*` capabilities, the record-scope
 * wave) and shapes the HTTP answer; everything below is what a program action
 * actually DOES:
 *
 *   - the list read and its per-program score: how the metric rows fold into a
 *     card, the completion index and its weights, the facilitator shaping;
 *   - creation: the slug, the duplicate-name rule, the date rules, the segment
 *     assignment, the default objectives and the audit/notification trail;
 *   - update: the quick archive action, the date rule, the status/is_archived
 *     sync, the manager-change notification and the segment re-sync;
 *   - deletion: the protected-data guard that refuses to erase history.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**` and returns a plain
 * `{ status, body }` the controller renders.
 */

import { v4 as uuidv4 } from "uuid";
import { logAuditEvent } from "@/services/tasks/auditLog";
import { assertNoParticipantFacilitatorConflict } from "@/lib/auth";
import {
  addParticipantToProgram,
  addProgramExpectedOutcomesColumn,
  addProgramSlugColumn,
  addProgramSuccessMetricsColumn,
  assignSegmentById,
  assignSegmentByName,
  autoActivatePlannedPrograms,
  countActiveParticipantsByProgram,
  countDocumentRequirementsByProgram,
  countProtectedProgramData,
  countReportWeeksByProgram,
  countSessionsByProgram,
  countSubmissionsByProgram,
  createProgram,
  createProgramKpi,
  createSystemFacilitatorsGroup,
  deleteProgramById,
  findProgramByExactName,
  getAssignedFamiliesByProgram,
  getContactsByFamilyGroupName,
  getProgramFacilitators,
  getProgramWithAssignedPm,
  getSegmentFamilyName,
  linkSegmentById,
  linkSegmentByName,
  listProgramsByManagementFilters,
  setProgramArchiveState,
  unlinkSegmentsFromProgram,
  updateProgram,
  createV2Program,
  ensureSystemFacilitatorsGroup,
  getAllPrograms,
  getFamilyNameById,
  getContactsByFamilyName,
  getProgramExists,
  updateProgramFields,
  unassignFamiliesNotInList,
  unassignAllFamilies,
  assignFamilyToProgram,
  addParticipantProgramMembership,
} from "@/models/programs";

/** The objectives a program starts with when none are supplied. */
const DEFAULT_KPIS = [
  { title: "Attendance Rate", target_value: 80 },
  { title: "Assignment Completion", target_value: 80 },
  { title: "Session Participation", target_value: 80 },
  { title: "Team Engagement", target_value: 80 },
  { title: "Coaching Completion", target_value: 80 },
  { title: "Graduation Rate", target_value: 80 },
];

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

/** A JSON-encoded map, or the value itself when it is already an object. */
function parseJsonObject(value) {
  if (typeof value !== "string") return value || {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
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

/** The slug a new program is registered under: name + a short id suffix. */
function buildProgramSlug(name, id) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 100) +
    "-" +
    id.substring(0, 8)
  );
}

/**
 * Create a program and everything that hangs off it: the system Facilitators
 * group, the assigned segments (and their participant membership), the default
 * objectives, and the audit/notification trail.
 *
 * @returns {Promise<{status: number, body: Object}>}
 */
export async function createProgramRecord({ payload, actor }) {
  const {
    name,
    description,
    concept_note,
    vision,
    objectives,
    program_type,
    visibility,
    language,
    note_id,
    assigned_pm_id,
    assigned_assistant_id,
    duration_weeks,
    materials,
    start_date,
    end_date,
    assigned_segments,
    kpis,
    expected_outcomes,
    success_metrics,
  } = payload;

  const id = uuidv4();
  const slug = buildProgramSlug(name, id);

  // Ensure new columns exist.
  try { await addProgramSlugColumn(); } catch (_) {}
  try { await addProgramExpectedOutcomesColumn(); } catch (_) {}
  try { await addProgramSuccessMetricsColumn(); } catch (_) {}

  // B6: Check duplicate program name.
  const existing = await findProgramByExactName(name);
  if (existing.rows.length > 0) {
    return {
      status: 409,
      body: { success: false, error: "A program with this name already exists." },
    };
  }

  // Prevent start date in the past.
  if (start_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(start_date) < today) {
      return {
        status: 400,
        body: { success: false, error: "Start date cannot be in the past." },
      };
    }
  }

  // Prevent end date before start date.
  if (start_date && end_date && new Date(end_date) < new Date(start_date)) {
    return {
      status: 400,
      body: { success: false, error: "End date cannot be earlier than start date." },
    };
  }

  await createProgram({
    id,
    name,
    slug,
    description,
    concept_note,
    vision,
    objectives,
    expected_outcomes,
    success_metrics,
    program_type,
    visibility,
    language,
    note_id,
    assigned_pm_id,
    assigned_assistant_id,
    duration_weeks,
    materials,
    start_date,
    end_date,
  });

  // Auto-create the system-defined Facilitators group for this program.
  try {
    await createSystemFacilitatorsGroup(id);
  } catch (_) {}

  // Handle Segment/Team Assignments for new program.
  if (Array.isArray(assigned_segments) && assigned_segments.length > 0) {
    for (const segmentId of assigned_segments) {
      if (!segmentId) continue;
      const numericSegmentId = !isNaN(segmentId) ? Number(segmentId) : null;
      if (numericSegmentId !== null) {
        await assignSegmentById(id, numericSegmentId);
      } else {
        await assignSegmentByName(id, segmentId);
      }
    }
  }

  // Handle KPIs — auto-populate defaults if none provided.
  const kpisToCreate = Array.isArray(kpis) && kpis.length > 0 ? kpis : DEFAULT_KPIS;
  for (const kpi of kpisToCreate) {
    if (!kpi.title) continue;
    await createProgramKpi(id, kpi.title, kpi.target_value);
  }

  // B10: Audit log.
  await logAuditEvent({
    entity_type: "program",
    entity_id: id,
    user_id: actor?.user_cid || "system",
    user_name: actor?.name || "System",
    action: "created",
    details: `Program "${name}" created`,
  });

  // B11: Notification PM assignment.
  if (assigned_pm_id) {
    await logAuditEvent({
      entity_type: "program_assignment",
      entity_id: id,
      user_id: assigned_pm_id,
      user_name: name,
      action: "assigned",
      details: `You have been assigned as Program Manager for "${name}"`,
    });
  }

  return { status: 200, body: { success: true, id } };
}

/**
 * Re-link a program's assigned segments and keep `participant_programs` in step.
 *
 * The unlink/resolve failures are logged and skipped (a legacy segment id must
 * never fail the whole update), and the same-program participant/facilitator
 * conflict guard silently skips a conflicting contact, as before.
 */
async function syncProgramSegments(id, assignedSegments) {
  // 1. Unlink segments currently assigned to this program. Guard: skip if the
  //    program_id column has legacy non-UUID values.
  try {
    await unlinkSegmentsFromProgram(id);
  } catch (error) {
    console.warn("[programs] Could not unlink families segments:", error.message);
  }

  // 2. Link the new set of segments.
  if (assignedSegments.length === 0) return;

  for (const segmentId of assignedSegments) {
    if (!segmentId) continue;
    const numericSegmentId = !isNaN(segmentId) ? Number(segmentId) : null;
    let familyName = "";

    if (numericSegmentId !== null) {
      try {
        await linkSegmentById(id, numericSegmentId);
      } catch (error) {
        console.warn("[programs] Could not link family by id:", error.message);
      }
      const familyNameResult = await getSegmentFamilyName(numericSegmentId);
      if (familyNameResult.rows && familyNameResult.rows.length > 0) {
        familyName = familyNameResult.rows[0].name;
      }
    } else {
      try {
        await linkSegmentByName(id, segmentId);
      } catch (error) {
        console.warn("[programs] Could not link family by name:", error.message);
      }
      familyName = segmentId;
    }

    // 3. Sync participant_programs for the new program assignment.
    //    (Phase 3: legacy contacts.program_id and v2_participants writes removed;
    //    participant_programs is now authoritative.)
    if (!familyName) continue;

    const contactsRes = await getContactsByFamilyGroupName(familyName);
    if (!contactsRes.rows || contactsRes.rows.length === 0) continue;

    for (const contact of contactsRes.rows) {
      const cCid = contact.cid;
      if (!cCid) continue;
      // Same-program conflict guard (Phase 2A).
      const conflictError = await assertNoParticipantFacilitatorConflict(
        id,
        cCid,
        contact.email || null,
      );
      if (conflictError) continue;
      try {
        await addParticipantToProgram(cCid, id);
      } catch (_) {
        // participant_programs table may not exist.
      }
    }
  }
}

/**
 * Update a program: the quick archive action, the field update, the audit and
 * manager notification, and the segment re-sync.
 *
 * @returns {Promise<{status: number, body: Object}>}
 */
export async function updateProgramRecord({ payload, actor }) {
  const {
    id,
    name,
    description,
    concept_note,
    vision,
    objectives,
    expected_outcomes,
    success_metrics,
    program_type,
    visibility,
    language,
    note_id,
    assigned_pm_id,
    assigned_assistant_id,
    duration_weeks,
    status,
    materials,
    assigned_segments,
    start_date,
    end_date,
    grading_mode,
    is_archived,
    facilitator_default_permissions,
    facilitator_scope,
  } = payload;

  // Verify the program exists before updating or assigning.
  const progExists = await getProgramWithAssignedPm(id);
  if (progExists.rows.length === 0) {
    return {
      status: 404,
      body: { success: false, error: `Program "${id}" not found.` },
    };
  }

  // Name required for non-archive updates.
  if (!name && is_archived === undefined) {
    return { status: 400, body: { success: false, error: "Name required" } };
  }

  // If is_archived is provided without a name, it's a quick archive action.
  if (is_archived !== undefined && !name) {
    const newStatus = is_archived ? "archived" : "active";
    await setProgramArchiveState(is_archived, newStatus, id);
    return { status: 200, body: { success: true } };
  }

  // Prevent end date before start date.
  if (start_date && end_date && new Date(end_date) < new Date(start_date)) {
    return {
      status: 400,
      body: { success: false, error: "End date cannot be earlier than start date." },
    };
  }

  // Sync status: if setting to archived, also mark is_archived.
  const finalIsArchived = status === "archived" ? 1 : 0;

  await updateProgram({
    id,
    name,
    description,
    concept_note,
    vision,
    objectives,
    expected_outcomes,
    success_metrics,
    program_type,
    visibility,
    language,
    note_id,
    assigned_pm_id,
    assigned_assistant_id,
    duration_weeks,
    status,
    is_archived: finalIsArchived,
    materials,
    start_date,
    end_date,
    grading_mode,
    facilitator_default_permissions,
    facilitator_scope,
  });

  // B10: Audit log.
  await logAuditEvent({
    entity_type: "program",
    entity_id: id,
    user_id: actor?.user_cid || "system",
    user_name: actor?.name || "System",
    action: "updated",
    details: `Program "${name}" updated`,
  });

  // B11: Notification PM assignment — only log when the PM actually changes.
  const previousPmId = progExists.rows[0]?.assigned_pm_id;
  if (assigned_pm_id && String(assigned_pm_id) !== String(previousPmId)) {
    await logAuditEvent({
      entity_type: "program_assignment",
      entity_id: id,
      user_id: assigned_pm_id,
      user_name: name,
      action: "assigned",
      details: `You have been assigned as Program Manager for "${name}"`,
    });
  }

  // Handle Segment/Team Assignments.
  if (Array.isArray(assigned_segments)) {
    await syncProgramSegments(id, assigned_segments);
  }

  return { status: 200, body: { success: true } };
}

/**
 * Delete a program, refusing when it carries protected historical data.
 *
 * @returns {Promise<{status: number, body: Object}>}
 */
export async function deleteProgramRecord({ id }) {
  // Phase 3C-7: refuse permanent deletion when the program carries protected
  // historical data (participants, sessions, submissions, deliverables).
  // Server-side enforcement — instruct to archive instead.
  const protectedRes = await countProtectedProgramData(id);
  if (Number(protectedRes.rows[0]?.protected_count || 0) > 0) {
    return {
      status: 409,
      body: {
        success: false,
        error:
          "Program contains protected data (participants, sessions, submissions, or deliverables). Archive it instead of deleting.",
      },
    };
  }

  await deleteProgramById(id);

  return { status: 200, body: { success: true } };
}

export async function createV2ProgramRecord({ payload }) {
  const {
    name,
    description,
    duration_weeks,
    duration_days,
    topics,
    outcomes,
    deliverables,
    resources,
    assigned_pm_id,
    feedback_enabled,
    grading_mode,
    evaluation_config,
  } = payload;

  if (!name) {
    return {
      status: 400,
      body: { success: false, error: "Program name is required" },
    };
  }

  const programId = `P-2026-${uuidv4().slice(0, 8).toUpperCase()}`;

  await createV2Program({
    programId,
    name,
    description,
    duration_weeks,
    duration_days,
    topics,
    outcomes,
    deliverables,
    resources,
    assigned_pm_id,
    feedback_enabled,
    grading_mode,
    evaluation_config,
  });

  // Auto-create the system-defined Facilitators group for this program
  try {
    await ensureSystemFacilitatorsGroup(programId);
  } catch (_) {}
  return {
    status: 200,
    body: {
      success: true,
      program: { id: programId, name, description },
    }
  };
}

export async function getV2ProgramDirectory({ canReadDirectory, id }) {
  const { rows } = await getAllPrograms();

  // Assignment-only callers may only see the single program they resolved.
  const scopedRows = !canReadDirectory && id ? rows.filter((row) => String(row.id) === String(id)) : rows;

  // Parse JSON columns
  const programs = scopedRows.map((row) => ({
    ...row,
    topics: row.topics ? parseJsonObject(row.topics) : [],
    outcomes: row.outcomes ? parseJsonObject(row.outcomes) : [],
    deliverables: row.deliverables ? parseJsonObject(row.deliverables) : [],
    resources: row.resources ? parseJsonObject(row.resources) : [],
    feedback_enabled: !!row.feedback_enabled,
  }));

  return { status: 200, body: { success: true, programs } };
}

export async function updateV2ProgramRecord({ payload }) {
  const data = payload;

  if (!data.id) {
    return {
      status: 400,
      body: { success: false, error: "Program ID is required for update." },
    };
  }

  // Verify the program exists before updating or assigning
  const progExists = await getProgramExists(data.id);
  if (progExists.rows.length === 0) {
    return {
      status: 404,
      body: { success: false, error: `Program "${data.id}" not found.` },
    };
  }

  const fieldsToUpdate = [];
  const args = [];

  // Whitelist updatable fields
  const updatableColumns = [
    "name",
    "description",
    "duration_weeks",
    "duration_days",
    "topics",
    "outcomes",
    "deliverables",
    "resources",
    "assigned_pm_id",
    "manager_name",
    "document_title",
    "document_id",
    "feedback_enabled",
    "status",
    "grading_mode",
    "evaluation_config",
  ];

  for (const col of updatableColumns) {
    if (data[col] !== undefined) {
      fieldsToUpdate.push(`${col} = ?`);

      if (["topics", "outcomes", "deliverables", "resources"].includes(col)) {
        args.push(JSON.stringify(data[col] || []));
      } else if (col === "feedback_enabled") {
        args.push(data[col] ? 1 : 0);
      } else if (col === "evaluation_config") {
        args.push(JSON.stringify(data[col] || {}));
      } else {
        args.push(data[col]);
      }
    }
  }

  if (fieldsToUpdate.length > 0) {
    // Add ID for the WHERE clause
    args.push(data.id);
    await updateProgramFields(fieldsToUpdate, args);
  }

  // ─── PERSIST GROUP-TO-PROGRAM LINKAGE ───
  // assigned_segments is an array of family/group IDs to link to this program.
  if (Array.isArray(data.assigned_segments)) {
    const programId = data.id;

    // 1. Un-assign families no longer in the list
    if (data.assigned_segments.length > 0) {
      await unassignFamiliesNotInList(programId, data.assigned_segments);
    } else {
      await unassignAllFamilies(programId);
    }

    // 2. Assign selected families
    for (const familyId of data.assigned_segments) {
      await assignFamilyToProgram(programId, familyId);

      // 3. Update contacts in this family
      const familyRes = await getFamilyNameById(familyId);
      const familyName = familyRes.rows[0]?.name;
      if (familyName) {
        // Phase 1: participant_programs is the authoritative membership.
        // Legacy contacts.program_id/program_name and v2_participants writes
        // have been removed.
        const contactsRes = await getContactsByFamilyName(familyName);
        for (const contact of contactsRes.rows) {
          if (!contact.cid) continue;
          // Same-program conflict guard (Phase 2A).
          const conflictError = await assertNoParticipantFacilitatorConflict(
            programId,
            contact.cid,
            contact.email || null,
          );
          if (conflictError) continue;
          try {
            await addParticipantProgramMembership(contact.cid, programId);
          } catch (_) {
            // participant_programs table may not exist
          }
        }
      }
    }
  }

  return { status: 200, body: { success: true } };
}
