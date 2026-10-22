/**
 * server/authz — capabilities.
 *
 * The ordered access levels and the roles that hold program-wide management
 * access. The permission vocabulary itself — which module exposes which
 * capability — now has ONE source (the feature/module capability registry under
 * `@/models/authorization/constants`) and is re-exported here as
 * PERMISSION_MODULES so this server-layer import path stays unchanged.
 *
 * Pure data and pure predicates: no database, no session. Safe to import from
 * anywhere that needs to reason about "what could this account do".
 */

import {
  INTERNAL_STAFF_ROLE,
  PLATFORM_OWNER_ROLE,
  PROGRAM_MANAGER_PROFILE,
  PROGRAM_MANAGER_ROLE,
  isInternalStaffRole,
  isLegacyProgramManagerRole,
  isPlatformOwnerRole,
} from "@/lib/identity";

export { PERMISSION_MODULES } from "@/models/authorization/constants/feature-module-capability";

export const ACCESS_LEVELS = {
  NONE: 0,
  VIEW: 1,
  CREATE: 2,
  EDIT: 3,
  DELETE: 4,
  FULL: 5,
};

// =============================================================================
// PROGRAM FACILITATOR AUTHORIZATION
// -----------------------------------------------------------------------------
// External facilitators are assigned per program via v2_program_staff rows with
// role = 'facilitator'. They are NOT Future Studio staff (group_name stays
// 'Facilitators' / anything other than 'FUTURE STUDIO').
//
// Permission resolution per program:
//   1. Individual override (v2_program_staff.permissions JSON map) wins
//   2. Otherwise program default (v2_programs.facilitator_default_permissions)
//   3. Otherwise denied
//
// Participant scope:
//   v2_programs.facilitator_scope = 'all'  -> whole program
//   'assigned_groups' -> groups where the facilitator is the lead
//     (families.lead_facilitator_id)
// =============================================================================

export const FACILITATOR_BYPASS_ROLES = [PLATFORM_OWNER_ROLE, PROGRAM_MANAGER_ROLE];

// NOTE: this list MUST stay aligned with hasProgramManagementAccess() below.
// "staff" is deliberately NOT included: staff program-delivery access is
// assignment-derived (enforced through the assignment guard), matching the
// live routes' gate. Keeping staff in the bypass list here would silently
// expand staff access when requireAssignmentAccess() is used.

/**
 * Roles with system-defined, program-wide management access. These roles keep
 * their existing program-management workflows and are NOT subject to the
 * per-program facilitator assignment check on shared program-data APIs.
 *
 * D-1 — when a resolved context is supplied, a baseline STAFF identity holding
 * the `program_manager` PROFILE also qualifies. Existing callers pass only the
 * role, so their behaviour is unchanged until they are migrated lot by lot.
 */
export function hasProgramManagementAccess(role, context = null) {
  if (isPlatformOwnerRole(role) || isLegacyProgramManagerRole(role)) return true;
  return (
    isInternalStaffRole(role) &&
    Array.isArray(context?.profiles) &&
    context.profiles.includes(PROGRAM_MANAGER_PROFILE)
  );
}

export {
  INTERNAL_STAFF_ROLE,
  PLATFORM_OWNER_ROLE,
  PROGRAM_MANAGER_PROFILE,
  PROGRAM_MANAGER_ROLE,
};
