/**
 * CONTACTS REGISTRY READ — the list/read decision.
 *
 * Whole-registry and cross-user reads need the contacts.view capability; every
 * session keeps the right to read its OWN contact record (self-service), so a
 * caller without the capability may only fetch its own cid. Super Admin sees the
 * archived set on request; staff/PMs see the active, role-appropriate window.
 * Each row is then enriched with its invitation status and two derived flags.
 *
 * Reads go through `@/models/contacts`; nothing here runs SQL.
 *
 * See docs/LAYER_SPLIT.md.
 */

import { attachInvitationStatus } from "@/models/invitations";
import {
  getContactByCid,
  getArchivedContacts,
} from "@/models/contacts/contactStore";
import {
  getContactsForSuperAdmin,
  getContactsForStaff,
  getParticipantProgramCids,
  getContactRoleAssignmentCids,
} from "@/models/contacts/directory";

/**
 * The registry rows this caller may see, or `{ denied: true }` when a
 * non-directory caller asks for somebody else's record.
 */
export async function readRegistryContacts({
  session,
  canReadDirectory,
  statusFilter,
  roleFilter,
  groupFilter,
  cidFilter,
}) {
  let rows;
  if (!canReadDirectory) {
    // Own record only — a caller-chosen cid is ignored unless it is the
    // session's own cid (self lookup).
    if (cidFilter && String(cidFilter) !== String(session.cid)) {
      return { denied: true };
    }
    rows = (await getContactByCid(cidFilter || session.cid)).rows || [];
  } else if (statusFilter === "archived" && session.role === "super_admin") {
    // Archived contacts (archived but not soft-deleted)
    rows = (await getArchivedContacts()).rows || [];
  } else if (cidFilter) {
    rows = (await getContactByCid(cidFilter)).rows || [];
  } else if (session.role === "super_admin") {
    rows = (await getContactsForSuperAdmin(roleFilter, statusFilter, groupFilter)).rows || [];
  } else {
    // Staff/PM (with contacts.view): active contacts only, with the
    // role-appropriate status window (PMs also see pending contacts so they
    // can find unapproved people and assign them as facilitators).
    rows = (await getContactsForStaff(session.role, groupFilter)).rows || [];
  }

  return { contacts: await enrichRegistryRows(rows) };
}

/** Attach the invitation status and the derived participant / assignment flags. */
async function enrichRegistryRows(rows) {
  const contactCids = rows.map((row) => row.cid).filter(Boolean);
  let participantCids = new Set();
  let assignmentCids = new Set();
  if (contactCids.length > 0) {
    // Best-effort: these tables may not exist in older schemas.
    try {
      const participantProgramsResult = await getParticipantProgramCids(contactCids);
      participantCids = new Set(
        participantProgramsResult.rows.map((row) => row.participant_id),
      );
    } catch (_) {}
    try {
      const contactRoleAssignmentsResult = await getContactRoleAssignmentCids(contactCids);
      assignmentCids = new Set(
        contactRoleAssignmentsResult.rows.map((row) => row.contact_cid),
      );
    } catch (_) {}
  }

  return (await attachInvitationStatus(rows)).map(
    ({ password: _password, ...safeContact }) => ({
      ...safeContact,
      // Derived flags: a participant enrollment OR the legacy role value.
      is_participant:
        participantCids.has(safeContact.cid) || safeContact.role === "participant",
      has_assignment: assignmentCids.has(safeContact.cid),
    }),
  );
}
