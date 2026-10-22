/**
 * UPLOAD QUALIFICATION (SERVICE layer).
 *
 * Writing a file to the public submissions bucket is not a capability of the
 * permission matrix: it is a QUALIFICATION. Phase 1.6 (C5a = A) allows:
 *
 *   - the platform owner and internal staff (the back office);
 *   - a team ENTITY session (the team's own attachments);
 *   - a VENTURE PERSON — a founder or a venture member; membership IS the
 *     qualification and it is resolved live, so a removed member loses it;
 *   - a participant holding an active program enrolment (self-service).
 *
 * A plain member account with no context cannot write to the bucket.
 *
 * This rule used to be written inline in the upload route with a role list.
 * It lives here so the route stays a controller, and so the decision can be
 * tested without an HTTP boundary. It reads through the models and runs no SQL.
 */

import { getContactContexts } from "@/models/authorization/contactContexts";
import { getActiveParticipantEnrollments } from "@/models/workspace";
import {
  isInternalStaffRole,
  isLegacyProgramManagerRole,
  isPlatformOwnerRole,
  normalizeRole,
} from "@/lib/identity";

/** The entity identity used by a team account (not a person's role). */
const TEAM_ENTITY = "team";

const ALLOWED = { allowed: true, status: 200, errorKey: null };
const DENIED = {
  allowed: false,
  status: 403,
  errorKey: "errors.insufficientPermissions",
};

/**
 * @param {{cid?: string, role?: string, email?: string}|null} session
 * @returns {Promise<{allowed: boolean, status: number, errorKey: string|null}>}
 */
export async function evaluateUploadAccess(session) {
  if (!session) {
    return { allowed: false, status: 401, errorKey: "errors.authRequired" };
  }

  const role = normalizeRole(session.role);
  if (
    isPlatformOwnerRole(role) ||
    isInternalStaffRole(role) ||
    isLegacyProgramManagerRole(role) ||
    role === TEAM_ENTITY
  ) {
    return ALLOWED;
  }

  const { contexts } = await getContactContexts(session.cid, { email: session.email });
  if ((contexts || []).some((context) => context.type === "venture")) {
    return ALLOWED;
  }

  const enrollments = await getActiveParticipantEnrollments(session.cid);
  if ((enrollments.rows || []).length > 0) {
    return ALLOWED;
  }

  return DENIED;
}
