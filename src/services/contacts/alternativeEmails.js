/**
 * CONTACT ALTERNATIVE EMAILS — the authorization decision.
 *
 * AUTHZ-CRM-1 — who may touch a contact's alternative emails?
 *
 *   - yourself                    → yes
 *   - Super Admin                 → yes (unscoped authority)
 *   - staff / program_manager     → only a contact who shares a PROGRAMME they
 *                                   are staffed on (a contact→programme rule)
 *   - anyone else                 → no
 *
 * This replaced a bare role check that let any staff-side caller manage EVERY
 * contact in the database. The decision lives here; the read goes through
 * `@/models/authorization/scope`. Nothing here runs SQL.
 *
 * See docs/LAYER_SPLIT.md.
 */

import { isContactWithinStaffedPrograms } from "@/services/authorization/scope";

const PRIVILEGED = ["super_admin", "staff", "program_manager"];

/** Whether `session` may manage the alternative emails of `targetCid`. */
export async function canManageContactEmails(session, targetCid) {
  if (!targetCid) return false;
  if (String(targetCid) === String(session?.cid)) return true;
  if (session?.role === "super_admin") return true;
  if (!PRIVILEGED.includes(session?.role)) return false;
  return isContactWithinStaffedPrograms(targetCid, session.cid, { email: session.email });
}
