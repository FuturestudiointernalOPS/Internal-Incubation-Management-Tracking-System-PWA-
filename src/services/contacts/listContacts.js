import { attachInvitationStatus } from "@/lib/invitations";
import {
  getContactByCid,
  getArchivedContacts,
  getContactsForSuperAdmin,
  getContactsForStaff,
  getParticipantProgramCids,
  getContactRoleAssignmentCids,
} from "@/models/contacts";

/**
 * List contacts for the current session.
 * Capability gate (`canReadDirectory`) is resolved in the controller.
 *
 * @returns {{ status: number, body: object }}
 */
export async function listContacts({
  session,
  canReadDirectory,
  statusFilter,
  roleFilter,
  groupFilter,
  cidFilter,
}) {
  let result;
  if (!canReadDirectory) {
    if (cidFilter && String(cidFilter) !== String(session.cid)) {
      return {
        status: 403,
        body: { success: false, error: "errors.insufficientPermissions" },
      };
    }
    result = await getContactByCid(cidFilter || session.cid);
  } else if (statusFilter === "archived" && session.role === "super_admin") {
    result = await getArchivedContacts();
  } else if (cidFilter) {
    result = await getContactByCid(cidFilter);
  } else if (session.role === "super_admin") {
    result = await getContactsForSuperAdmin(roleFilter, statusFilter, groupFilter);
  } else {
    result = await getContactsForStaff(session.role, groupFilter);
  }

  const rows = result.rows || [];
  const contactCids = rows.map((row) => row.cid).filter(Boolean);
  let participantCids = new Set();
  let assignmentCids = new Set();
  if (contactCids.length > 0) {
    try {
      const participantProgramsResult = await getParticipantProgramCids(contactCids);
      participantCids = new Set(
        participantProgramsResult.rows.map((row) => row.participant_id),
      );
    } catch (_) {}
    try {
      const contactRoleAssignmentsResult =
        await getContactRoleAssignmentCids(contactCids);
      assignmentCids = new Set(
        contactRoleAssignmentsResult.rows.map((row) => row.contact_cid),
      );
    } catch (_) {}
  }

  const contacts = (await attachInvitationStatus(rows)).map(
    ({ password: _password, ...safeContact }) => ({
      ...safeContact,
      is_participant:
        participantCids.has(safeContact.cid) ||
        safeContact.role === "participant",
      has_assignment: assignmentCids.has(safeContact.cid),
    }),
  );

  return { status: 200, body: { success: true, contacts } };
}
