/**
 * D-8 — THE MESSAGING MODE COMES FROM THE PROFILE, NOT THE URL.
 *
 * A program manager's inbox is narrower than the staff inbox: it offers the
 * contacts of the programs they manage, not the whole directory. That mode used
 * to be selected by the PAGE (`/pm/messages` passed `role="program_manager"`),
 * which meant the same person got two different scopes depending on the door
 * they came through — the bell sent them to `/staff/messages`, the sidebar to
 * another route, and the scope followed the URL.
 *
 * Under D-1 the manager function is the `program_manager` PROFILE, so the mode
 * is answered here, once, from the profile the server resolved. The section role
 * remains the fallback: a member's inbox, a legacy `program_manager` session
 * (rollback) and an entity account keep their previous mode.
 */

import {
  holdsProfile,
  PROGRAM_MANAGER_PROFILE,
  PROGRAM_MANAGER_ROLE,
} from "@/lib/identity";

/**
 * @param {{sectionRole?: string|null, profiles?: string[], isSuperAdmin?: boolean}} input
 * @returns {string} the role the messaging scoping rules read
 */
export function resolveMessagingRole({
  sectionRole = null,
  profiles = [],
  isSuperAdmin = false,
} = {}) {
  if (isSuperAdmin) return "super_admin";
  if (holdsProfile(profiles, PROGRAM_MANAGER_PROFILE)) return PROGRAM_MANAGER_ROLE;
  return sectionRole;
}
