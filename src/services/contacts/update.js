/**
 * CONTACT UPDATE — the field/program-sync rules.
 *
 * `role` is a server-controlled column: only a caller who may assign roles can
 * change it (the route resolves `canAssignRole`). `archived_at`/`archived_by` are
 * deliberately NOT caller-settable — the caller sends the single intent
 * `archived: true|false` and the server writes both, so an archiver cannot
 * attribute the archive to somebody else or date it themselves. Group names are
 * normalized to UPPERCASE at write time (matches the membership layer).
 *
 * These rules live here; the capability gates, the facilitator-conflict guard
 * (which answers HTTP) and the envelope stay on the route. Reads and writes go
 * through `@/models/contacts`; nothing here runs SQL.
 *
 * See docs/LAYER_SPLIT.md.
 */

import {
  getProgramById,
  removeContactProgramsExcept,
  clearContactPrograms,
  addContactProgramMembership,
  recordParticipantProgramAudit,
} from "@/models/contacts/programMembership";
import {
  getContactIdentityByCid,
  markAdminNotificationsRead,
} from "@/models/contacts/contactStore";

/** Roles that are not participants: promoting to one drops the enrollment. */
const NON_PARTICIPANT_ROLES = [
  "facilitator",
  "staff",
  "super_admin",
  "investor",
  "founder",
  "program_manager",
];

/**
 * Build the SET clause + args for a contact update. Returns `{ noFields: true }`
 * when the request names no updatable field.
 */
export function buildContactUpdate({ data, canAssignRole, actor }) {
  const fieldsToUpdate = [];
  const args = [];

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
        // Normalize group names to UPPERCASE at write time (matches the
        // membership layer) so case variants can never be re-created.
        fieldsToUpdate.push("group_name = ?");
        args.push(String(value || "").trim().toUpperCase());
      } else {
        fieldsToUpdate.push(`${column} = ?`);
        args.push(column === "deleted" ? (value ? 1 : 0) : value);
      }
    }
  }

  // Archive / restore: one intent, recorded by the server. The moment is the
  // server's clock and the actor is the session, never the request body.
  if (data.archived !== undefined) {
    fieldsToUpdate.push("archived_at = ?", "archived_by = ?");
    if (data.archived) args.push(new Date().toISOString(), actor);
    else args.push(null, null);
  }

  if (fieldsToUpdate.length === 0) return { noFields: true };

  args.push(data.cid);
  return { fieldsToUpdate, args };
}

/** Which program-sync branch this update falls into. */
export function planContactProgramSync(data) {
  const isRolePromotion = Boolean(data.role) && NON_PARTICIPANT_ROLES.includes(data.role);
  if (isRolePromotion) return { rolePromotion: true, programIds: null };
  if (Array.isArray(data.program_ids)) return { rolePromotion: false, programIds: data.program_ids };
  return { rolePromotion: false, programIds: null };
}

/** The first program in the list that does not exist, or null when all exist. */
export async function findMissingProgram(programIds) {
  for (const programId of programIds) {
    const programResult = await getProgramById(programId);
    if (programResult.rows.length === 0) return programId;
  }
  return null;
}

/** Replace the contact's program memberships with `programIds` (audited). */
export async function applyContactProgramMembership({ cid, programIds, assignedBy }) {
  if (programIds.length > 0) {
    await removeContactProgramsExcept(cid, programIds);
  } else {
    await clearContactPrograms(cid);
  }

  for (const programId of programIds) {
    try {
      await addContactProgramMembership(cid, programId);
      await recordParticipantProgramAudit(cid, programId, assignedBy ?? "system");
    } catch (error) {
      console.error(`PUT program sync error for ${cid}, program ${programId}:`, error.message);
    }
  }
}

/**
 * On an approval/activation, purge the admin access-request notifications. A
 * no-op for any other status.
 */
export async function completeContactUpdate({ cid, status }) {
  if (status !== "active" && status !== "approved") return;
  try {
    const identityResult = await getContactIdentityByCid(cid);
    if (identityResult.rows.length > 0) {
      const contactRow = identityResult.rows[0];
      // Fire invite for approved staff is intentionally NOT done here — invite
      // is sent on registration, not on approval.
      await markAdminNotificationsRead(contactRow.name);
    }
  } catch (error) {
    console.error("Auto-Purge Failure:", error);
  }
}
