/**
 * Programs — the v2 program records (SERVICE layer).
 *
 * The domain work behind `/api/programs`: the v2 create (its generated program
 * id and system Facilitators group), the directory read with its JSON-column
 * shaping and its assignment-only scoping, and the whitelisted field update with
 * its family/participant membership sync. The CONTROLLER keeps authentication,
 * the `programs.view`/assignment gates, the record-scope wave and the response
 * envelope.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and shaping, no SQL, no HTTP. It
 * reads and writes through `@/models/**` and returns a plain `{ status, body }`.
 */

import { v4 as uuidv4 } from "uuid";
import { assertNoParticipantFacilitatorConflict } from "@/server/authz/guards";
import {
  addParticipantProgramMembership,
  assignFamilyToProgram,
  createV2Program,
  ensureSystemFacilitatorsGroup,
  getAllPrograms,
  getContactsByFamilyName,
  getFamilyNameById,
  getProgramExists,
  unassignAllFamilies,
  unassignFamiliesNotInList,
  updateProgramFields,
} from "@/models/programs";
import { parseJsonObject } from "./programShared";

/**
 * Create a v2 program record (its generated id, then the system Facilitators
 * group). Returns the new program identity in the body.
 *
 * @returns {Promise<{status: number, body: Object}>}
 */
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

/**
 * The v2 program directory. An assignment-only caller sees only the single
 * program it resolved (by id); a directory reader sees everything.
 */
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

/**
 * Update a v2 program: the whitelisted field update, then the family/segment
 * membership sync (`participant_programs` is the authoritative membership).
 *
 * @returns {Promise<{status: number, body: Object}>}
 */
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
