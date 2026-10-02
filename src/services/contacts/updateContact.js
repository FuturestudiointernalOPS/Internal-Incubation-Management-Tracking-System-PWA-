import { assertNoParticipantFacilitatorConflict, getSession } from "@/lib/auth";
import {
  updateContactFields,
  deleteContactPrograms,
  getProgramById,
  removeContactProgramsExcept,
  clearContactPrograms,
  addContactProgramMembership,
  recordParticipantProgramAudit,
  ensureContactProgramMembership,
  getContactIdentityByCid,
  markAdminNotificationsRead,
} from "@/models/contacts";

/**
 * Read a conflict Response-like return into { status, body }.
 * assertNoParticipantFacilitatorConflict historically returns an HTTP Response.
 */
async function conflictToResult(conflictResponse) {
  if (!conflictResponse) return null;
  if (typeof conflictResponse.json === "function") {
    const body = await conflictResponse.json();
    return { status: conflictResponse.status || 409, body };
  }
  if (conflictResponse.status && conflictResponse.body) return conflictResponse;
  return { status: 409, body: { success: false, error: "errors.roleConflictParticipantFacilitator" } };
}

/**
 * Update a contact's fields and sync program membership.
 * Auth / FUTURE STUDIO / canAssignRole gates stay in the controller.
 *
 * @returns {{ status: number, body: object }}
 */
export async function updateContact({ data, canAssignRole, session: sessionHint }) {
  if (!data.cid) {
    return {
      status: 400,
      body: { success: false, error: "Contact ID (cid) is required for update." },
    };
  }

  const fieldsToUpdate = [];
  const args = [];

  // `archived_at` and `archived_by` are deliberately NOT caller-settable.
  // `role` is a server-controlled boundary.
  const updatableColumns = [
    "name",
    "email",
    "phone",
    "address",
    "dob",
    "group_name",
    ...(canAssignRole ? ["role"] : []),
    "program_id",
    "program_name",
    "image",
    "status",
    "deleted",
    "gender",
    "mother_name",
  ];

  for (const column of updatableColumns) {
    if (data[column] !== undefined) {
      let value = data[column];
      if (typeof value === "string") value = value.trim();

      if (column === "email") {
        fieldsToUpdate.push(`${column} = ?`);
        args.push(value.toLowerCase());
      } else if (column === "group_name") {
        fieldsToUpdate.push("group_name = ?");
        args.push(String(value || "").trim().toUpperCase());
      } else {
        fieldsToUpdate.push(`${column} = ?`);
        args.push(column === "deleted" ? (value ? 1 : 0) : value);
      }
    }
  }

  if (data.archived !== undefined) {
    const session = sessionHint || (await getSession());
    const actor = session?.name || session?.email || session?.cid || "unknown";
    fieldsToUpdate.push("archived_at = ?", "archived_by = ?");
    if (data.archived) args.push(new Date().toISOString(), actor);
    else args.push(null, null);
  }

  if (fieldsToUpdate.length === 0) {
    return {
      status: 200,
      body: { success: true, message: "No fields to update." },
    };
  }

  args.push(data.cid);

  const updateResult = await updateContactFields(fieldsToUpdate, args);

  const NON_PARTICIPANT_ROLES = [
    "facilitator",
    "staff",
    "super_admin",
    "investor",
    "founder",
    "program_manager",
  ];
  const isRolePromotion = data.role && NON_PARTICIPANT_ROLES.includes(data.role);

  if (isRolePromotion) {
    await deleteContactPrograms(data.cid);
  } else if (Array.isArray(data.program_ids)) {
    for (const programId of data.program_ids) {
      const programResult = await getProgramById(programId);
      if (programResult.rows.length === 0) {
        return {
          status: 404,
          body: {
            success: false,
            error: `Program "${programId}" not found. Create it first before assigning.`,
          },
        };
      }
    }

    for (const programId of data.program_ids) {
      const conflictError = await assertNoParticipantFacilitatorConflict(
        programId,
        data.cid,
        data.email || null,
      );
      if (conflictError) {
        const mapped = await conflictToResult(conflictError);
        return mapped;
      }
    }

    if (data.program_ids.length > 0) {
      await removeContactProgramsExcept(data.cid, data.program_ids);
    } else {
      await clearContactPrograms(data.cid);
    }

    for (const programId of data.program_ids) {
      try {
        await addContactProgramMembership(data.cid, programId);
        await recordParticipantProgramAudit(
          data.cid,
          programId,
          data.assigned_by || "system",
        );
      } catch (error) {
        console.error(
          `PUT program sync error for ${data.cid}, program ${programId}:`,
          error.message,
        );
      }
    }
  } else if (data.program_id) {
    try {
      const conflictError = await assertNoParticipantFacilitatorConflict(
        data.program_id,
        data.cid,
        data.email || null,
      );
      if (conflictError) {
        const mapped = await conflictToResult(conflictError);
        return mapped;
      }
      await ensureContactProgramMembership(data.cid, data.program_id);
    } catch (error) {
      console.error(`PUT program sync error for ${data.cid}:`, error.message);
    }
  }

  if (data.status === "active" || data.status === "approved") {
    try {
      const identityResult = await getContactIdentityByCid(data.cid);
      if (identityResult.rows.length > 0) {
        const contactRow = identityResult.rows[0];
        await markAdminNotificationsRead(contactRow.name);
      }
    } catch (error) {
      console.error("Auto-Purge Failure:", error);
    }
  }

  return {
    status: 200,
    body: {
      success: true,
      rowsAffected: updateResult.rowsAffected,
    },
  };
}
