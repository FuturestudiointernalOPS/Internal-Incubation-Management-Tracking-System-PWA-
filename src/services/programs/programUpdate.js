/**
 * Programs — updating a program (SERVICE layer).
 *
 * The domain work behind `PUT /api/pm/programs`: the quick archive shortcut, the
 * date rule, the status/is_archived sync, the audit and manager-change
 * notification, and the segment re-sync that keeps `participant_programs` in
 * step. The CONTROLLER keeps authentication, the `programs.edit` capability, the
 * record-scope wave and the response envelope.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It writes through `@/models/**` and returns a plain `{ status, body }`.
 */

import { logAuditEvent } from "@/services/tasks/auditLog";
import { assertNoParticipantFacilitatorConflict } from "@/lib/auth";
import {
  addParticipantToProgram,
  getContactsByFamilyGroupName,
  getProgramWithAssignedPm,
  getSegmentFamilyName,
  linkSegmentById,
  linkSegmentByName,
  setProgramArchiveState,
  unlinkSegmentsFromProgram,
  updateProgram,
} from "@/models/programs";

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
