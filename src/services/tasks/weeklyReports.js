/**
 * Tasks — weekly report visibility (SERVICE layer).
 *
 * One rule shared by the standup and the retro endpoints: a person reads their
 * OWN report, a supervisor may read a supervisee's, and the platform owner may
 * read anyone's. Every other caller is refused.
 *
 * The rule used to be copied into both route handlers, as a role comparison
 * plus `isSupervisorOf`. It lives here once so the two screens can never drift,
 * and so the comparison goes through the identity vocabulary.
 */

import { isPlatformOwnerRole } from "@/lib/identity";
import { isSupervisorOf } from "@/models/authorization/accessQueries";

const ALLOWED = { allowed: true, status: 200, errorKey: null };

/**
 * @param {Object} args
 * @param {{cid?: string, role?: string}|null} args.session
 * @param {string|null} args.targetCid   the person whose report is requested
 * @param {string} args.denialKey        the i18n key for "own report only"
 * @returns {Promise<{allowed: boolean, status: number, errorKey: string|null}>}
 */
export async function evaluateWeeklyReportAccess({ session, targetCid, denialKey }) {
  if (!session) {
    return { allowed: false, status: 401, errorKey: "errors.authRequired" };
  }
  if (isPlatformOwnerRole(session.role)) return ALLOWED;
  if (String(targetCid) === String(session.cid)) return ALLOWED;
  if (await isSupervisorOf(session.cid, targetCid)) return ALLOWED;

  return { allowed: false, status: 403, errorKey: denialKey };
}
